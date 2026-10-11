import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, Eye, FileVideo, History, LogOut, RefreshCw, Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { ReplayGameInfo, ServerMessage, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/art/icons'
import { Scenery } from '@/components/art/Scenery'
import { ConnBadge } from '@/components/game/ConnBadge'
import type { ConnStatus } from '@/hooks/useRoomSocket'
import { PHASE_TITLE } from '../game/helpers'
import { AdminBoard } from './AdminBoard'
import { AuthError, adminApi, downloadReplay, duration, fmtDateTime, gameStatus, loadAdminToken, saveAdminToken, type AdminGame, type AdminRoom, type GameEvent } from './adminApi'
import { ReplayPlayer } from './ReplayPlayer'

type View = { kind: 'list' } | { kind: 'live'; code: string } | { kind: 'replay'; id: string }

/** 后台：?admin */
export function Admin() {
  const [token, setToken] = useState(loadAdminToken)
  useEffect(() => {
    document.title = '后台 - 狼人杀'
  }, [])
  const logout = useCallback(() => {
    saveAdminToken(null)
    setToken(null)
  }, [])
  if (!token)
    return (
      <Login
        onLogin={(t) => {
          saveAdminToken(t)
          setToken(t)
        }}
      />
    )
  return <Dashboard token={token} onLogout={logout} />
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!pw) return
    setBusy(true)
    try {
      onLogin((await adminApi<{ token: string }>('/api/admin/login', { password: pw })).token)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Scenery night dim />
      <Logo className="size-32" />
      <h1 className="flex items-center gap-2 font-display text-4xl text-gold-grad">
        <Shield className="size-8 text-gold" /> 管理后台
      </h1>
      <div className="panel w-full max-w-sm space-y-3 p-5">
        <Input
          type="password"
          value={pw}
          autoFocus
          placeholder="管理员密码"
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="h-11 bg-black/30 text-base"
        />
        <Button variant="gold" size="xl" className="w-full" disabled={busy || !pw} onClick={submit}>
          进入后台
        </Button>
      </div>
    </div>
  )
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [tab, setTab] = useState<'rooms' | 'games'>('rooms')
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [fetchedAt, setFetchedAt] = useState(0)
  const [games, setGames] = useState<AdminGame[]>([])

  const guard = useCallback(
    (e: unknown) => {
      if (e instanceof AuthError) {
        toast.error(e.message)
        onLogout()
      } else toast.error((e as Error).message)
    },
    [onLogout],
  )

  const refresh = useCallback(() => {
    adminApi<AdminRoom[]>('/api/admin/rooms').then((r) => {
      setRooms(r)
      setFetchedAt(Date.now())
    }, guard)
    adminApi<AdminGame[]>('/api/admin/games').then(setGames, guard)
  }, [guard])

  useEffect(() => {
    if (view.kind !== 'list') return
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [view.kind, refresh])

  return (
    <div className="flex h-dvh flex-col gap-4 px-6 py-4">
      <Scenery night dim />
      <header className="flex items-center gap-3">
        {view.kind !== 'list' ? (
          <Button variant="stone" size="sm" onClick={() => setView({ kind: 'list' })}>
            <ArrowLeft /> 返回
          </Button>
        ) : (
          <Logo className="size-10" />
        )}
        <h1 className="font-display text-2xl text-gold-grad">
          {view.kind === 'list' ? '管理后台' : view.kind === 'live' ? `上帝视角 · 房间 ${view.code}` : '对局回放'}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {view.kind === 'list' && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <a href="?replay" target="_blank" rel="noreferrer">
                  <FileVideo /> 本地回放查看器
                </a>
              </Button>
              <Button variant="stone" size="sm" onClick={refresh}>
                <RefreshCw /> 刷新
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut /> 退出
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view.kind === 'live' && <LiveView code={view.code} token={token} onAuthFail={onLogout} />}
        {view.kind === 'replay' && <ServerReplay id={view.id} onError={guard} />}
        {view.kind === 'list' && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex gap-2">
              {(
                [
                  ['rooms', `房间（进行中 ${rooms.filter((r) => r.inGame).length}）`],
                  ['games', `对局记录（${games.length}）`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn('rounded-full px-4 py-1.5 text-sm transition', tab === k ? 'bg-gold text-[#2a1a05]' : 'bg-black/40 text-gold-soft')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'rooms' ? (
                <RoomList rooms={rooms} fetchedAt={fetchedAt} onOpen={(code) => setView({ kind: 'live', code })} />
              ) : (
                <GameList games={games} onOpen={(id) => setView({ kind: 'replay', id })} onError={guard} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RoomList({ rooms, fetchedAt, onOpen }: { rooms: AdminRoom[]; fetchedAt: number; onOpen: (code: string) => void }) {
  if (!rooms.length) return <div className="py-16 text-center text-muted-foreground">暂无房间</div>
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {rooms.map((r) => (
        <div key={r.code} className="panel flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-widest text-gold-grad">{r.code}</span>
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs', r.inGame ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-muted-foreground')}>
              {r.inGame ? `第${r.day}天 · ${PHASE_TITLE[r.phase as keyof typeof PHASE_TITLE] ?? r.phase}` : '未开局'}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            法官 {r.judge} · 入座 {r.seated}/{r.seats}
            {r.spectators > 0 && ` · 观战 ${r.spectators}`}
          </div>
          <IdleInfo room={r} now={fetchedAt} />
          <Button variant={r.inGame ? 'gold' : 'stone'} size="sm" className="mt-1" onClick={() => onOpen(r.code)}>
            <Eye /> 上帝视角
          </Button>
        </div>
      ))}
    </div>
  )
}

/** 最后操作时间与自动解散倒计时（列表每 5 秒刷新一次） */
function IdleInfo({ room, now }: { room: AdminRoom; now: number }) {
  const idle = Math.max(0, now - room.lastActiveAt)
  const left = Math.max(0, room.idleTimeoutMs - idle)
  const mins = (ms: number) => (ms < 60_000 ? '不到 1 分钟' : `${Math.floor(ms / 60_000)} 分钟`)
  return (
    <div className={cn('text-xs', left < 5 * 60_000 ? 'text-amber-300' : 'text-muted-foreground')}>
      最后操作 {idle < 60_000 ? '刚刚' : `${mins(idle)}前`} · {mins(left)}后无操作将自动解散
    </div>
  )
}

/** 对局列表：每次发牌算一局，同一房间的多局分别列出 */
function GameList({ games, onOpen, onError }: { games: AdminGame[]; onOpen: (id: string) => void; onError: (e: unknown) => void }) {
  const [q, setQ] = useState('')
  const shown = q ? games.filter((g) => g.code.includes(q)) : games
  return (
    <div className="space-y-3">
      <Input
        value={q}
        inputMode="numeric"
        placeholder="按房间号筛选"
        onChange={(e) => setQ(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="h-9 max-w-xs bg-black/30"
      />
      {shown.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">{games.length ? '没有匹配的对局' : '还没有对局记录'}</div>
      ) : (
        <div className="panel divide-y divide-white/5 overflow-hidden p-0">
          {shown.map((g) => {
            const [label, cls] = gameStatus(g)
            return (
              <div key={g.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <div className="w-36 shrink-0">
                  <div className="font-display text-lg text-gold-soft">第 {g.round} 局</div>
                  <div className="text-xs text-muted-foreground">房间 {g.code}</div>
                </div>
                <span className={cn('w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs', cls)}>{label}</span>
                <span className="text-muted-foreground">{g.backfilled ? `${fmtDateTime(g.startedAt)} 最后操作` : `${fmtDateTime(g.startedAt)} 发牌`}</span>
                <span className="text-muted-foreground">{duration(g)}</span>
                <span className="text-muted-foreground">
                  法官 {g.judge} · {g.players} 人 · {g.events} 个事件
                </span>
                {g.backfilled && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">补记 · 仅最终局面</span>}
                {g.recovered && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">从数据库残留恢复</span>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => downloadReplay(g.id).catch(onError)} aria-label="下载回放">
                  <Download /> 下载
                </Button>
                <Button variant="stone" size="sm" onClick={() => onOpen(g.id)}>
                  <History /> 回放
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------- 实时上帝视角 ----------------

function LiveView({ code, token, onAuthFail }: { code: string; token: string; onAuthFail: () => void }) {
  const [state, setState] = useState<StateView | null>(null)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [gone, setGone] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      if (stopped) return
      setStatus('connecting')
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws?admin=${encodeURIComponent(token)}&code=${encodeURIComponent(code)}`)
      ws.onopen = () => setStatus('open')
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage
        if (msg.type === 'state') setState(msg.state)
        if (msg.type === 'kicked') {
          stopped = true
          setGone(msg.reason)
          if (msg.reason.includes('登录')) onAuthFail()
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setStatus('closed')
        timer = setTimeout(connect, 2000)
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [code, token, onAuthFail])

  if (gone) return <div className="py-20 text-center text-lg text-gold-soft">{gone}</div>
  if (!state) return <div className="py-20 text-center text-gold-soft">正在连接…</div>
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex justify-end">
        <ConnBadge status={status} className="text-xs" />
      </div>
      <div className="min-h-0 flex-1">
        <AdminBoard state={state} />
      </div>
    </div>
  )
}

// ---------------- 回放 ----------------

interface GameDetail extends ReplayGameInfo {
  events: GameEvent[]
}

/** 后台回放：从服务端按需加载每个时间点的局面 */
function ServerReplay({ id, onError }: { id: string; onError: (e: unknown) => void }) {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    adminApi<GameDetail>(`/api/admin/games/${id}`).then(setDetail, onError)
  }, [id, onError])
  const loadView = useCallback((seq: number) => adminApi<StateView>(`/api/admin/games/${id}/events/${seq}`), [id])
  if (!detail) return <div className="py-20 text-center text-gold-soft">正在加载对局…</div>
  return (
    <ReplayPlayer
      key={id}
      game={detail}
      events={detail.events}
      loadView={loadView}
      onError={onError}
      actions={
        <Button
          variant="stone"
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            downloadReplay(id)
              .catch(onError)
              .finally(() => setBusy(false))
          }}
        >
          <Download /> {busy ? '正在打包…' : '下载回放'}
        </Button>
      }
    />
  )
}
