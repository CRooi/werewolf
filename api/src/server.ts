import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import path from 'node:path'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from '../../shared/types'
import { deleteRoom, loadRooms, saveRoom } from './db'
import { GameError, Room, genCode } from './room'

const rooms = new Map<string, Room>()
for (const d of loadRooms()) rooms.set(d.code, new Room(d))

/** 大屏观战连接的 key 前缀，不对应任何玩家 */
const SPECTATOR_PREFIX = 'spec:'
const isSpectator = (key: string) => key.startsWith(SPECTATOR_PREFIX)

/** code -> userId（或观战 key）-> sockets */
const sockets = new Map<string, Map<string, Set<WebSocket>>>()

const online = (code: string) => (userId: string) => (sockets.get(code)?.get(userId)?.size ?? 0) > 0

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function sendUser(code: string, userId: string, msg: ServerMessage) {
  for (const ws of sockets.get(code)?.get(userId) ?? []) send(ws, msg)
}

function broadcast(room: Room) {
  const conns = sockets.get(room.d.code)
  if (!conns) return
  let spectatorMsg: ServerMessage | null = null
  for (const userId of conns.keys()) {
    if (isSpectator(userId)) {
      spectatorMsg ??= { type: 'state', state: room.spectatorView(online(room.d.code)) }
      sendUser(room.d.code, userId, spectatorMsg)
      continue
    }
    if (!room.d.users[userId]) continue
    sendUser(room.d.code, userId, { type: 'state', state: room.view(userId, online(room.d.code)) })
  }
}

const app = express()
app.use(express.json())

function wrap(fn: (req: express.Request, res: express.Response) => void) {
  return (req: express.Request, res: express.Response) => {
    try {
      fn(req, res)
    } catch (e) {
      if (e instanceof GameError) res.status(400).json({ error: e.message })
      else {
        console.error(e)
        res.status(500).json({ error: '服务器错误' })
      }
    }
  }
}

app.post('/api/rooms', wrap((req, res) => {
  const code = genCode((c) => rooms.has(c))
  const { room, user } = Room.create(code, req.body?.config ?? {}, req.body?.name)
  rooms.set(code, room)
  saveRoom(room.d)
  res.json({ code, token: user.token })
}))

app.post('/api/rooms/:code/join', wrap((req, res) => {
  const room = rooms.get(String(req.params.code))
  if (!room) return void res.status(404).json({ error: '房间不存在' })
  const user = room.join(req.body?.name)
  saveRoom(room.d)
  broadcast(room)
  res.json({ code: room.d.code, token: user.token })
}))

app.get('/api/rooms/:code', wrap((req, res) => {
  const room = rooms.get(String(req.params.code))
  if (!room) return void res.status(404).json({ error: '房间不存在' })
  const token = String(req.query.token ?? '')
  res.json({
    code: room.d.code,
    seats: room.d.seats.length,
    seated: room.d.seats.filter(Boolean).length,
    inGame: room.inGame,
    member: !!(token && room.userByToken(token)),
  })
}))

// 生产环境：托管前端构建产物
const dist = path.resolve(import.meta.dir, '../../dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://x')
  const code = url.searchParams.get('code') ?? ''
  const token = url.searchParams.get('token') ?? ''
  const room = rooms.get(code)

  // 大屏观战：只读，收到的是所有人可见的公开状态
  if (url.searchParams.has('spectate')) {
    if (!room) {
      send(ws, { type: 'kicked', reason: '房间不存在或已解散' })
      return ws.close()
    }
    const key = SPECTATOR_PREFIX + crypto.randomUUID()
    let byKey = sockets.get(code)
    if (!byKey) sockets.set(code, (byKey = new Map()))
    byKey.set(key, new Set([ws]))
    send(ws, { type: 'state', state: room.spectatorView(online(code)) })
    ws.on('message', (raw) => {
      if (String(raw).includes('"ping"')) send(ws, { type: 'pong' })
    })
    ws.on('close', () => byKey!.delete(key))
    return
  }

  const user = room?.userByToken(token)
  if (!room || !user) {
    send(ws, { type: 'kicked', reason: room ? '你已不在该房间' : '房间不存在或已解散' })
    ws.close()
    return
  }
  let byUser = sockets.get(code)
  if (!byUser) sockets.set(code, (byUser = new Map()))
  let set = byUser.get(user.id)
  if (!set) byUser.set(user.id, (set = new Set()))
  set.add(ws)
  broadcast(room)

  ws.on('message', (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    if (msg.type === 'ping') return send(ws, { type: 'pong' })
    const cur = rooms.get(code)
    if (!cur || !cur.d.users[user.id]) {
      send(ws, { type: 'kicked', reason: '你已不在该房间' })
      return ws.close()
    }
    try {
      const fx = cur.handle(user.id, msg)
      if (fx.disband) {
        rooms.delete(code)
        deleteRoom(code)
        for (const [, s] of sockets.get(code) ?? []) for (const w of s) { send(w, { type: 'kicked', reason: '房间已被法官解散' }); w.close() }
        sockets.delete(code)
        return
      }
      saveRoom(cur.d)
      if (fx.kicked) {
        const reason = fx.kicked === user.id ? '你已离开房间' : '你被法官请出了房间'
        for (const w of byUser!.get(fx.kicked) ?? []) { send(w, { type: 'kicked', reason }); w.close() }
        byUser!.delete(fx.kicked)
      }
      if (fx.swapResult) sendUser(code, fx.swapResult.to, { type: 'swapResult', accepted: fx.swapResult.accepted, by: fx.swapResult.by })
      broadcast(cur)
    } catch (e) {
      if (e instanceof GameError) send(ws, { type: 'error', message: e.message })
      else {
        console.error(e)
        send(ws, { type: 'error', message: '服务器错误' })
      }
    }
  })

  ws.on('close', () => {
    set!.delete(ws)
    const r = rooms.get(code)
    if (r) broadcast(r)
  })
})

const port = Number(process.env.PORT ?? 3001)
server.listen(port, () => console.log(`🐺 werewolf api listening on http://localhost:${port}`))
