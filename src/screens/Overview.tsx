import { useEffect, useRef, useState } from 'react'
import { Monitor } from 'lucide-react'
import { ROLE_NAME, ROLE_ORDER, type Announcement, type GameView, type StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROLE_THEME, RoleEmblem } from '@/components/art/RoleArt'
import { Scenery } from '@/components/art/Scenery'
import { EyeClosed, Logo, Skull } from '@/components/art/icons'
import { ConnBadge } from '@/components/game/ConnBadge'
import { avatarHue } from '@/components/game/PlayerToken'
import { roleLabel } from '@/components/game/RoleCard'
import { useSpectator } from '@/hooks/useSpectator'
import { SystemUpdating } from '@/components/game/SystemUpdating'
import { PHASE_TITLE, isNight } from './game/helpers'

/** 大屏入口：?overview=房间码；未带房间码时先输入 */
export function Overview() {
  const initial = new URLSearchParams(location.search).get('overview') ?? ''
  const [code, setCode] = useState(/^\d{4}$/.test(initial) ? initial : '')
  if (!code) return <CodeForm onSubmit={(c) => { history.replaceState(null, '', `?overview=${c}`); setCode(c) }} />
  return <Board code={code} />
}

function CodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Scenery night />
      <Logo className="size-40" />
      <h1 className="flex items-center gap-3 font-display text-5xl text-gold-grad">
        <Monitor className="size-10 text-gold" /> 大屏模式
      </h1>
      <div className="panel flex w-full max-w-md gap-3 p-4">
        <Input
          value={v}
          autoFocus
          inputMode="numeric"
          maxLength={4}
          placeholder="房间码"
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && v.length === 4 && onSubmit(v)}
          className="h-14 bg-black/30 text-center font-display text-3xl tracking-[0.5em]"
        />
        <Button variant="gold" size="xl" disabled={v.length !== 4} onClick={() => onSubmit(v)}>
          投屏
        </Button>
      </div>
    </div>
  )
}

function Board({ code }: { code: string }) {
  const { state, status, gone, upgrading } = useSpectator(code)
  useEffect(() => {
    document.title = `大屏 · 房间 ${code} - 狼人杀`
  }, [code])

  const g = state?.game && (state.room.inGame || state.game.phase === 'revealed') ? state.game : null
  const night = g ? isNight(g.phase) || g.phase === 'dealt' : true
  const announce = useAnnouncementPopup(g)

  return (
    <div className="flex h-dvh w-full flex-col gap-[2vh] overflow-hidden px-[2.5vw] py-[2.5vh]">
      <Scenery night={night} dim={!!g && !night} />
      <SystemUpdating upgrading={upgrading} ready={!!state} />
      {/* 顶栏 */}
      <header className="flex items-center gap-[1.5vw]">
        <Logo className="size-[7vh]" />
        <span className="font-display text-[4.2vh] leading-none text-gold-grad">狼人杀</span>
        <div className="mx-auto">
          {g && (
            <div key={g.phase} className="animate-rise flex items-center gap-[1vw] rounded-full border border-gold/30 bg-black/45 px-[2vw] py-[0.8vh] backdrop-blur">
              <span className="text-[2.2vh] tracking-[0.3em] text-gold-soft/80">
                {g.phase === 'dealt' ? '准备' : isNight(g.phase) ? `第 ${g.day} 夜` : `第 ${g.day} 天`}
              </span>
              <span className="font-display text-[3.4vh] text-gold-grad">{PHASE_TITLE[g.phase]}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-[1vw]">
          <ConnBadge status={status} className="gap-[0.5vw] text-[1.8vh]" dotClassName="size-[1.2vh]" />
          <span className="rounded-full bg-black/45 px-[1.2vw] py-[0.6vh] text-[2vh] text-muted-foreground">
            房间 <span className="font-display text-[3vh] tracking-widest text-gold-soft">{code}</span>
          </span>
        </div>
      </header>

      {!state ? (
        <div className="flex flex-1 items-center justify-center font-display text-[4vh] text-gold-soft/80">
          {gone ?? (status === 'open' ? '正在加载…' : '正在连接房间…')}
        </div>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,28vw)] gap-[2vw]">
          <Table state={state} g={g} />
          <aside className="panel flex min-h-0 flex-col p-[2vh]">{g ? <Timeline g={g} /> : <JoinPanel state={state} />}</aside>
        </main>
      )}

      {announce && <AnnouncementPopup items={announce} g={g!} />}
    </div>
  )
}

// ---------------- 圆桌 ----------------

export function Table({ state, g }: { state: StateView; g: GameView | null }) {
  const seats = state.room.seats
  const n = seats.length
  return (
    <section className="relative min-h-0">
      {/* 桌面 */}
      <div className="absolute top-1/2 left-1/2 flex h-[46%] w-[48%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[50%] border border-gold/30 bg-[radial-gradient(ellipse_at_center,rgba(30,37,80,0.92),rgba(10,14,36,0.92))] p-[3%] text-center shadow-[0_0_80px_-10px_rgba(232,180,90,0.35),inset_0_0_40px_rgba(0,0,0,0.6)]">
        <Center state={state} g={g} />
      </div>
      {seats.map((u, i) => {
        // 1 号位在正上方，顺时针排列
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2
        const left = 50 + 42 * Math.cos(a)
        const top = 50 + 41 * Math.sin(a)
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
            <SeatBadge seat={i} name={u?.name ?? null} online={u?.online ?? false} g={g} />
          </div>
        )
      })}
    </section>
  )
}

function SeatBadge({ seat, name, online, g }: { seat: number; name: string | null; online: boolean; g: GameView | null }) {
  const p = g?.players[seat]
  const dead = p ? !p.alive : false
  const role = p?.role
  const night = g ? isNight(g.phase) : false
  const vote = g?.vote && ['voting', 'vote_result', 'idiot'].includes(g.phase) ? g.vote : null
  const voters = vote ? vote.voters.filter((s) => vote.ballots[s]?.choice === seat) : []
  // 上帝视角（后台）才有狼人数据：刀人阶段显示每只狼选了谁
  const wolfPickers = g?.wolf && g.phase === 'wolf_pick' ? g.wolf.aliveSeats.filter((s) => g.wolf!.selections[s] === seat) : []
  const eliminated = vote?.result?.eliminated === seat
  const isCandidate = vote?.candidates?.includes(seat)
  const hue = name ? avatarHue(name) : 0

  return (
    <div className={cn('flex w-[11vh] flex-col items-center gap-[0.6vh] text-center', dead && 'opacity-70')}>
      <div className="relative">
        <div
          className={cn(
            'relative flex size-[10vh] items-center justify-center overflow-hidden rounded-full ring-[0.4vh] transition',
            eliminated ? 'ring-blood shadow-[0_0_30px_rgba(210,60,60,0.8)]' : isCandidate ? 'ring-gold shadow-[0_0_24px_rgba(232,180,90,0.7)]' : 'ring-gold/50',
            !name && 'ring-white/15',
            dead && 'grayscale',
          )}
          style={name && !role ? { background: `radial-gradient(circle at 35% 30%, hsl(${hue} 70% 62%), hsl(${hue} 55% 28%))` } : name ? undefined : { background: 'rgba(255,255,255,0.05)' }}
        >
          {role ? (
            <RoleEmblem role={role} className="size-full scale-[1.35]" />
          ) : (
            <span className="font-display text-[4.5vh] text-white drop-shadow">{name?.slice(0, 1) ?? ''}</span>
          )}
          {dead && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <Skull className="size-[6vh]" />
            </div>
          )}
        </div>
        <span className="absolute -top-[0.6vh] -left-[0.6vh] flex size-[3.6vh] items-center justify-center rounded-full border border-[#7a5418] bg-[linear-gradient(180deg,#ffe9b0,#c98e33)] font-display text-[2vh] font-bold text-[#3a2305] shadow">
          {seat + 1}
        </span>
        {night && !dead && (
          <span className="absolute -right-[0.6vh] -bottom-[0.4vh] flex h-[2.8vh] w-[4.4vh] items-center justify-center rounded-full bg-black/80 ring-1 ring-white/10">
            <EyeClosed className="h-[1.8vh] w-[3.2vh] text-white/60" />
          </span>
        )}
        {name && !online && <span className="absolute bottom-[0.4vh] left-[0.4vh] size-[1.6vh] rounded-full border-2 border-[#0a0e24] bg-zinc-500" />}
      </div>
      <div className={cn('max-w-full truncate text-[2.2vh] leading-tight', dead ? 'text-white/50 line-through' : name ? 'text-[#f3ead6]' : 'text-white/30')}>
        {name ?? '空位'}
      </div>
      {role && (
        <div className="text-[1.8vh] leading-none" style={{ color: ROLE_THEME[role].accent }}>
          {roleLabel(role)}
        </div>
      )}
      {wolfPickers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-[0.3vh]">
          {wolfPickers.map((s) => (
            <span key={s} className="flex h-[2.4vh] items-center rounded-full bg-blood/85 px-[0.6vh] text-[1.5vh] font-bold text-white">
              🐾{s + 1}
            </span>
          ))}
        </div>
      )}
      {voters.length > 0 && (
        <div className="flex flex-wrap justify-center gap-[0.3vh]">
          {voters.map((s) => {
            const confirmed = vote!.ballots[s]!.confirmed
            return (
              <span
                key={s}
                className={cn(
                  'flex h-[2.4vh] min-w-[2.4vh] items-center justify-center rounded-full px-[0.4vh] text-[1.5vh] font-bold',
                  confirmed ? 'bg-gold text-[#1a1006]' : 'border border-dashed border-gold text-gold',
                )}
              >
                {s + 1}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Center({ state, g }: { state: StateView; g: GameView | null }) {
  if (!g) {
    const filled = state.room.seats.filter(Boolean).length
    const total = state.room.seats.length
    return (
      <>
        <div className="text-[2.2vh] tracking-[0.4em] text-gold-soft/70">等待开局</div>
        <div className="font-display text-[9vh] leading-none text-gold-grad">
          {filled}/{total}
        </div>
        <div className="mt-[1vh] text-[2.2vh] text-muted-foreground">{filled === total ? '人已到齐，等待法官开始游戏' : '输入房间码入座'}</div>
      </>
    )
  }

  if (g.phase === 'revealed' || g.phase === 'game_over') {
    if (!g.winner) return <div className="font-display text-[6vh] text-gold-grad">游戏结束</div>
    const wolf = g.winner === 'wolf'
    return (
      <>
        <div className={cn('relative size-[14vh] overflow-hidden rounded-full ring-[0.5vh]', wolf ? 'ring-red-500/80' : 'ring-emerald-400/80')}>
          <RoleEmblem role={wolf ? 'werewolf' : 'villager'} className="size-full scale-125" />
        </div>
        <div className={cn('mt-[1vh] font-display text-[8vh] leading-none', wolf ? 'text-red-400' : 'text-emerald-300')}>{wolf ? '狼人胜利' : '好人胜利'}</div>
      </>
    )
  }

  const night = isNight(g.phase) || g.phase === 'dealt'
  const v = g.vote
  const alive = g.players.filter((p) => p.alive).length
  return (
    <>
      <div className="text-[5vh] leading-none">{night ? '🌙' : '☀️'}</div>
      <div key={g.phase} className="animate-rise mt-[1vh] font-display text-[6vh] leading-tight text-gold-grad">
        {PHASE_TITLE[g.phase]}
      </div>
      {g.phase === 'voting' && v ? (
        <div className="mt-[1.5vh] w-[70%]">
          <div className="mb-[0.6vh] flex justify-between text-[2vh] text-gold-soft/80">
            <span>{v.round > 1 ? 'PK 投票' : '投票进行中'}</span>
            <span>
              已确认 {v.voters.filter((s) => v.ballots[s]?.confirmed).length}/{v.voters.length}
            </span>
          </div>
          <div className="h-[1vh] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#f0c46c,#c98e33)] transition-all"
              style={{ width: `${(v.voters.filter((s) => v.ballots[s]?.confirmed).length / v.voters.length) * 100}%` }}
            />
          </div>
        </div>
      ) : ['vote_result', 'idiot'].includes(g.phase) && v?.result ? (
        <div className="mt-[1vh] text-[2.6vh] text-gold-soft">{v.result.note}</div>
      ) : (
        <div className="mt-[1vh] text-[2.2vh] text-muted-foreground">
          {night ? '夜幕笼罩村庄，请安静等待…' : `存活 ${alive} 人`}
        </div>
      )}
    </>
  )
}

// ---------------- 侧栏 ----------------

function JoinPanel({ state }: { state: StateView }) {
  const c = state.room.config
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-[2vh] text-center">
      <div className="text-[2.2vh] tracking-[0.3em] text-gold-soft/70">房间码</div>
      <div className="font-display text-[10vh] leading-none tracking-[0.2em] text-gold-grad">{state.room.code}</div>
      <div className="divider-ornament w-full text-[1.6vh]">✦ 本局板子 ✦</div>
      <div className="flex flex-wrap justify-center gap-[0.8vh]">
        {ROLE_ORDER.filter((r) => c[r] > 0).map((r) => (
          <span key={r} className="rounded-full border border-gold/25 bg-black/40 px-[1.4vh] py-[0.5vh] text-[2vh] text-gold-soft">
            {ROLE_NAME[r]} × {c[r]}
          </span>
        ))}
      </div>
      {c.witch > 0 && (
        <div className="text-[1.9vh] text-muted-foreground">
          女巫：{c.witchBothSameNight ? '双药可同晚使用' : '每晚只能使用一瓶药'} · {c.witchSelfSave ? '可以自救' : '第一晚不能自救'}
        </div>
      )}
      <div className="mt-auto text-[2vh] text-muted-foreground">
        法官：<span className="text-gold-soft">{state.room.judge.name}</span>
      </div>
    </div>
  )
}

const ANN_ICON: Record<Announcement['kind'], string> = { night: '🌙', vote: '⚖️', hunter: '🏹', info: '📜' }

function Timeline({ g }: { g: GameView }) {
  const revealed = g.phase === 'revealed'
  const items = revealed && g.judgeLog ? g.judgeLog.map((t) => ({ icon: '📜', text: t })) : [...g.announcements].reverse().map((a) => ({ icon: ANN_ICON[a.kind], text: `第${a.day}天 · ${a.text}` }))
  return (
    <>
      <div className="mb-[1.5vh] font-display text-[3vh] text-gold-grad">{revealed ? '完整复盘' : '公告'}</div>
      <div className="min-h-0 flex-1 space-y-[1vh] overflow-y-auto pr-[0.5vw]">
        {items.length === 0 && <div className="py-[4vh] text-center text-[2.2vh] text-muted-foreground">暂无公告</div>}
        {items.map((it, i) => (
          <div key={i} className={cn('flex gap-[0.8vw] rounded-xl bg-black/35 px-[1vw] py-[1vh] text-[2.1vh] leading-snug', i === 0 && !revealed && 'animate-rise ring-1 ring-gold/40')}>
            <span>{it.icon}</span>
            <span className="flex-1">{it.text}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------------- 公告弹窗 ----------------

/** 新公告在大屏中央展示几秒后自动收起 */
function useAnnouncementPopup(g: GameView | null) {
  const seen = useRef<{ id: string; count: number } | null>(null)
  const [items, setItems] = useState<Announcement[] | null>(null)
  useEffect(() => {
    if (!g) return
    const prev = seen.current
    seen.current = { id: g.id, count: g.announcements.length }
    // 首次加载或换了新对局时不回放旧公告
    if (!prev || prev.id !== g.id || g.announcements.length <= prev.count) return
    setItems((cur) => [...(cur ?? []), ...g.announcements.slice(prev.count)])
  }, [g])
  // 自动收起：只跟随弹窗内容计时，不受其他状态推送影响
  useEffect(() => {
    if (!items) return
    const t = setTimeout(() => setItems(null), 7000)
    return () => clearTimeout(t)
  }, [items])
  return items
}

function AnnouncementPopup({ items, g }: { items: Announcement[]; g: GameView }) {
  const titles: Record<Announcement['kind'], string> = { night: '天亮了', vote: '放逐结果', hunter: '一声枪响', info: '公告' }
  const first = items[0]!
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-[3vh] bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className={cn('font-display text-[12vh] leading-none', first.kind === 'hunter' ? 'text-red-400' : 'text-gold-grad')}>{titles[first.kind]}</div>
      {items.map((a, i) => (
        <div key={i} className="animate-rise flex flex-col items-center gap-[2vh]" style={{ animationDelay: `${i * 0.25}s` }}>
          {a.seats.length > 0 && (
            <div className="flex gap-[3vw]">
              {a.seats.map((s) => (
                <div key={s} className="flex flex-col items-center gap-[1vh]">
                  <div className="flex size-[14vh] items-center justify-center rounded-full bg-black/60 ring-[0.4vh] ring-red-500/70">
                    <Skull className="size-[9vh]" />
                  </div>
                  <span className="text-[3vh]">
                    {s + 1}号 {g.players[s]?.user.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[3.6vh] text-[#f3ead6]">{a.text}</div>
        </div>
      ))}
    </div>
  )
}
