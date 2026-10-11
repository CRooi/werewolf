import { timingSafeEqual } from 'node:crypto'
import type express from 'express'
import type { ClientMessage, JudgeStep } from '../../shared/types'
import {
  addGameEvent,
  createGameRecord,
  finishGameRecord,
  getGameEvents,
  getGameEventState,
  getGameRecord,
  listGameRecords,
} from './db'
import { type GameState, type ReplayMeta, Room } from './room'

// ---------------- 鉴权 ----------------

const TOKEN_TTL = 12 * 3600 * 1000
const tokens = new Map<string, number>()

export const adminEnabled = () => !!process.env.ADMIN_PASSWORD

function checkPassword(input: unknown) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? '')
  const got = Buffer.from(String(input ?? ''))
  return expected.length > 0 && got.length === expected.length && timingSafeEqual(got, expected)
}

export function verifyAdminToken(token: string | null | undefined) {
  if (!token) return false
  const exp = tokens.get(token)
  if (!exp) return false
  if (exp < Date.now()) {
    tokens.delete(token)
    return false
  }
  return true
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
  if (!verifyAdminToken(token)) return void res.status(401).json({ error: '请重新登录' })
  next()
}

// ---------------- 对局记录 ----------------

const STEP_TEXT: Record<JudgeStep, string> = {
  nightStart: '天黑请闭眼',
  wolfWake: '狼人请睁眼',
  wolfPick: '请狼人确认猎杀对象',
  wolfClose: '狼人请闭眼',
  seerWake: '预言家请睁眼',
  seerPick: '请预言家选择查验对象',
  seerReveal: '验明身份',
  seerClose: '预言家请闭眼',
  witchWake: '女巫请睁眼',
  witchInform: '告知女巫死亡信息',
  witchClose: '女巫请闭眼',
  dawn: '天亮了',
  voteStart: '开始投票',
  tieRevote: '平票 PK 重投',
  tieNone: '平票无人出局',
  reveal: '公布结果',
}

const seatText = (s: number) => `${s + 1}号`

/** 把一次操作描述成人能读懂的一句话 */
function describe(msg: ClientMessage): string {
  switch (msg.type) {
    case 'start':
      return '开始游戏，发牌'
    case 'judge':
      return STEP_TEXT[msg.step]
    case 'tieChoose':
      return `指定 ${seatText(msg.seat)} 出局`
    case 'openEyes':
      return '睁眼'
    case 'wolfSelect':
      return msg.choice === null ? '取消选择' : msg.choice === 'none' ? '选择今晚不猎杀' : `选择猎杀 ${seatText(msg.choice)}`
    case 'wolfConfirm':
      return '确认猎杀'
    case 'wolfChat':
      return `狼人频道：${msg.text}`
    case 'ghostChat':
      return `观战频道：${msg.text}`
    case 'seerSelect':
      return `查看 ${seatText(msg.seat)}`
    case 'seerConfirm':
      return '确认查验'
    case 'witchAct': {
      const acts = [msg.save && '使用解药', msg.poison !== null && `对 ${seatText(msg.poison)} 使用毒药`].filter(Boolean)
      return acts.length ? acts.join('，') : '不使用药剂'
    }
    case 'voteSelect':
      return msg.choice === null ? '取消投票选择' : msg.choice === 'abstain' ? '选择弃票' : `选择投给 ${seatText(msg.choice)}`
    case 'voteConfirm':
      return '确认投票'
    case 'hunterShoot':
      return msg.target === null ? '猎人选择不带人' : `猎人开枪带走 ${seatText(msg.target)}`
    case 'idiotDecide':
      return msg.reveal ? '亮明白痴身份' : '不亮身份，直接出局'
    case 'abort':
      return '终止对局'
    default:
      return msg.type
  }
}

function actorLabel(room: Room, userId: string) {
  const name = room.d.users[userId]?.name ?? '?'
  if (userId === room.d.judgeId) return `法官 ${name}`
  if (room.isSpectator(userId)) return `观战 ${name}`
  const seat = room.d.game?.seats.indexOf(userId) ?? -1
  return seat >= 0 ? `${seat + 1}号 ${name}` : name
}

export interface BeforeAction {
  gameId: string | null
  json: string | null
  announcements: number
}

export function snapshotBefore(room: Room): BeforeAction {
  const g = room.d.game
  return { gameId: g?.id ?? null, json: g ? JSON.stringify(g) : null, announcements: g?.announcements.length ?? 0 }
}

/** 在一次成功的操作之后记录事件；ping 等未改变对局的操作会被忽略 */
export function recordAction(room: Room, userId: string, msg: ClientMessage, before: BeforeAction, disband = false) {
  try {
    const g = room.d.game
    const actor = actorLabel(room, userId)
    const now = Date.now()

    // 对局被终止或房间被解散
    if (before.gameId && before.json && (disband || g?.id !== before.gameId)) {
      const prev = JSON.parse(before.json) as GameState
      if (prev.phase !== 'revealed') {
        addGameEvent(before.gameId, { ts: now, actor, text: disband ? '解散房间，对局终止' : '终止对局', phase: prev.phase, day: prev.day, state: prev })
        finishGameRecord(before.gameId, 'aborted', null)
      }
    }
    if (!g || disband) return

    // 新对局
    if (g.id !== before.gameId) {
      createGameRecord(g.id, room.d.code, room.replayMeta())
      addGameEvent(g.id, { ts: now, actor, text: describe(msg), phase: g.phase, day: g.day, state: g })
      return
    }

    const json = JSON.stringify(g)
    if (json === before.json) return
    // 本次操作引发的公告（死讯、放逐、开枪等）一并写进事件
    const fresh = g.announcements.slice(before.announcements).map((a) => a.text)
    const text = [describe(msg), ...fresh].join(' → ')
    addGameEvent(g.id, { ts: now, actor, text, phase: g.phase, day: g.day, state: g })
    if (g.phase === 'revealed') finishGameRecord(g.id, 'finished', g.winner)
  } catch (e) {
    console.error('记录对局事件失败', e)
  }
}

// ---------------- 接口 ----------------

export function registerAdminRoutes(app: express.Express, rooms: Map<string, Room>, online: (code: string) => (id: string) => boolean) {
  app.post('/api/admin/login', async (req, res) => {
    if (!adminEnabled()) return void res.status(503).json({ error: '未配置管理员密码（ADMIN_PASSWORD）' })
    if (!checkPassword(req.body?.password)) {
      await Bun.sleep(600) // 减缓暴力尝试
      return void res.status(401).json({ error: '密码错误' })
    }
    const token = crypto.randomUUID() + crypto.randomUUID()
    tokens.set(token, Date.now() + TOKEN_TTL)
    res.json({ token })
  })

  app.get('/api/admin/rooms', requireAdmin, (_req, res) => {
    res.json(
      [...rooms.values()]
        .map((r) => {
          const g = r.d.game
          return {
            code: r.d.code,
            judge: r.d.users[r.d.judgeId]?.name ?? '?',
            seats: r.d.seats.length,
            seated: r.d.seats.filter(Boolean).length,
            spectators: r.d.spectators.length,
            inGame: r.inGame,
            phase: g?.phase ?? null,
            day: g?.day ?? null,
            gameId: g?.id ?? null,
            createdAt: r.d.createdAt,
          }
        })
        .sort((a, b) => Number(b.inGame) - Number(a.inGame) || b.createdAt - a.createdAt),
    )
  })

  app.get('/api/admin/rooms/:code', requireAdmin, (req, res) => {
    const room = rooms.get(String(req.params.code))
    if (!room) return void res.status(404).json({ error: '房间不存在' })
    res.json(room.adminView(online(room.d.code)))
  })

  app.get('/api/admin/games', requireAdmin, (_req, res) => {
    res.json(
      listGameRecords().map((g) => {
        const meta = JSON.parse(g.meta) as ReplayMeta
        return { id: g.id, code: g.code, status: g.status, winner: g.winner, startedAt: g.started_at, endedAt: g.ended_at, events: g.events, judge: meta.users[meta.judgeId] ?? '?', players: Object.keys(meta.users).length - 1 }
      }),
    )
  })

  app.get('/api/admin/games/:id', requireAdmin, (req, res) => {
    const g = getGameRecord(String(req.params.id))
    if (!g) return void res.status(404).json({ error: '对局不存在' })
    res.json({ id: g.id, code: g.code, status: g.status, winner: g.winner, startedAt: g.started_at, endedAt: g.ended_at, events: getGameEvents(g.id) })
  })

  app.get('/api/admin/games/:id/events/:seq', requireAdmin, (req, res) => {
    const g = getGameRecord(String(req.params.id))
    const state = g && (getGameEventState(g.id, Number(req.params.seq)) as GameState | null)
    if (!g || !state) return void res.status(404).json({ error: '事件不存在' })
    res.json(Room.replayView(JSON.parse(g.meta) as ReplayMeta, state))
  })
}
