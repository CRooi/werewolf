import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, History, LogOut, Pause, Play, RefreshCw, Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { ServerMessage, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/art/icons'
import { Scenery } from '@/components/art/Scenery'
import { ConnBadge } from '@/components/game/ConnBadge'
import type { ConnStatus } from '@/hooks/useRoomSocket'
import { PHASE_TITLE } from '../game/helpers'
import { AdminBoard } from './AdminBoard'
import { AuthError, adminApi, fmtDateTime, fmtTime, loadAdminToken, saveAdminToken, type AdminGame, type AdminRoom, type GameEvent } from './adminApi'

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
            <Button variant="stone" size="sm" onClick={refresh}>
              <RefreshCw /> 刷新
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut /> 退出
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view.kind === 'live' && <LiveView code={view.code} token={token} onAuthFail={onLogout} />}
        {view.kind === 'replay' && <Replay id={view.id} onError={guard} />}
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
                <GameList games={games} onOpen={(id) => setView({ kind: 'replay', id })} />
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

function GameList({ games, onOpen }: { games: AdminGame[]; onOpen: (id: string) => void }) {
  if (!games.length) return <div className="py-16 text-center text-muted-foreground">还没有对局记录</div>
  const status = (g: AdminGame) =>
    g.status === 'playing'
      ? ['进行中', 'bg-emerald-500/20 text-emerald-300']
      : g.status === 'aborted'
        ? ['已终止', 'bg-white/10 text-muted-foreground']
        : [g.winner === 'wolf' ? '狼人胜利' : '好人胜利', g.winner === 'wolf' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300']
  return (
    <div className="panel divide-y divide-white/5 overflow-hidden p-0">
      {games.map((g) => {
        const [label, cls] = status(g)
        return (
          <div key={g.id} className="flex items-center gap-4 px-4 py-3 text-sm">
            <span className="w-16 font-display text-lg tracking-widest text-gold-soft">{g.code}</span>
            <span className={cn('w-20 rounded-full px-2 py-0.5 text-center text-xs', cls)}>{label}</span>
            <span className="text-muted-foreground">{fmtDateTime(g.startedAt)}</span>
            <span className="text-muted-foreground">
              {g.endedAt ? `用时 ${Math.max(1, Math.round((g.endedAt - g.startedAt) / 60000))} 分钟` : '—'}
            </span>
            <span className="text-muted-foreground">
              法官 {g.judge} · {g.players} 人 · {g.events} 个事件
            </span>
            <Button variant="stone" size="sm" className="ml-auto" onClick={() => onOpen(g.id)}>
              <History /> 回放
            </Button>
          </div>
        )
      })}
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

interface GameDetail {
  id: string
  code: string
  status: AdminGame['status']
  winner: AdminGame['winner']
  startedAt: number
  endedAt: number | null
  events: GameEvent[]
}

const SPEEDS = [1, 2, 4]

function Replay({ id, onError }: { id: string; onError: (e: unknown) => void }) {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [index, setIndex] = useState(0)
  const [views, setViews] = useState<Record<number, StateView>>({})
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    adminApi<GameDetail>(`/api/admin/games/${id}`).then((d) => {
      setDetail(d)
      setIndex(0)
    }, onError)
  }, [id, onError])

  const events = useMemo(() => detail?.events ?? [], [detail])
  const current = events[index]

  // 按需加载某个时间点的局面，并预取下一个
  useEffect(() => {
    if (!current) return
    for (const ev of [current, events[index + 1]]) {
      if (!ev || views[ev.seq]) continue
      adminApi<StateView>(`/api/admin/games/${id}/events/${ev.seq}`).then((v) => setViews((m) => ({ ...m, [ev.seq]: v })), onError)
    }
  }, [current, events, index, id, views, onError])

  // 自动播放：播到最后一个事件自然停止
  const isPlaying = playing && index < events.length - 1
  useEffect(() => {
    if (!isPlaying) return
    const t = setTimeout(() => setIndex((i) => i + 1), 1200 / speed)
    return () => clearTimeout(t)
  }, [isPlaying, index, speed])

  // 当前事件滚动到可视区域
  useEffect(() => {
    listRef.current?.querySelector(`[data-seq="${current?.seq}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current?.seq])

  // ← → 切换事件，空格播放 / 暂停
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(events.length - 1, i + 1))
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [events.length])

  if (!detail) return <div className="py-20 text-center text-gold-soft">正在加载对局…</div>
  if (!events.length) return <div className="py-20 text-center text-gold-soft">这局没有记录到事件</div>

  // 无快照时显示最近一次已加载的局面，避免闪烁
  const view = (() => {
    for (let i = index; i >= 0; i--) {
      const v = views[events[i]!.seq]
      if (v) return v
    }
    return null
  })()
  const elapsed = current ? current.ts - detail.startedAt : 0

  const timeline = (
    <div ref={listRef} className="space-y-1">
      {events.map((ev, i) => (
        <button
          key={ev.seq}
          data-seq={ev.seq}
          onClick={() => {
            setIndex(i)
            setPlaying(false)
          }}
          className={cn(
            'flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
            i === index ? 'bg-gold/25 ring-1 ring-gold/60' : i < index ? 'bg-black/30 text-white/70' : 'bg-black/15 text-white/45 hover:bg-black/30',
          )}
        >
          <span className="shrink-0 font-mono text-muted-foreground">{fmtTime(ev.ts)}</span>
          <span className="shrink-0 text-gold-soft">{ev.actor}</span>
          <span className="min-w-0 flex-1 break-words">{ev.text}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1">{view ? <AdminBoard state={view} extraTab={{ label: '时间轴', content: timeline }} /> : <div className="py-20 text-center text-gold-soft">加载局面…</div>}</div>

      {/* 时间轴控制条 */}
      <div className="panel flex items-center gap-3 px-4 py-3">
        <Button variant="stone" size="icon-lg" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="上一步">
          <ChevronLeft />
        </Button>
        <Button
          variant="gold"
          size="icon-lg"
          onClick={() => {
            if (index >= events.length - 1) setIndex(0)
            setPlaying(!isPlaying)
          }}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button variant="stone" size="icon-lg" onClick={() => setIndex((i) => Math.min(events.length - 1, i + 1))} aria-label="下一步">
          <ChevronRight />
        </Button>
        <button className="rounded-full bg-black/40 px-2.5 py-1 text-xs text-gold-soft" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}>
          {speed}×
        </button>
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(e) => {
            setIndex(Number(e.target.value))
            setPlaying(false)
          }}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-[#e8b45a]"
        />
        <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {index + 1}/{events.length}
        </span>
        <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
          +{Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}
        </span>
      </div>
      {current && (
        <div className="-mt-1 truncate px-1 text-sm">
          <span className="font-mono text-muted-foreground">{fmtTime(current.ts)}</span>
          <span className="mx-2 text-gold-soft">{current.actor}</span>
          {current.text}
        </div>
      )}
    </div>
  )
}
