import type { Announcement, GameView, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { EyeClosed, EyeOpen } from '@/components/art/icons'
import { PHASE_TITLE, isNight } from './helpers'

function Moon() {
  return (
    <svg viewBox="0 0 64 64" className="size-12 shrink-0 animate-float drop-shadow-[0_0_14px_rgba(246,220,160,0.6)]" aria-hidden>
      <defs>
        <radialGradient id="stm" cx="40%" cy="35%">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="1" stopColor="#d8b46a" />
        </radialGradient>
      </defs>
      <path d="M40 6 A26 26 0 1 0 58 44 A22 22 0 1 1 40 6 Z" fill="url(#stm)" />
    </svg>
  )
}

function Sun() {
  return (
    <svg viewBox="0 0 64 64" className="size-12 shrink-0 animate-[spin_30s_linear_infinite] drop-shadow-[0_0_14px_rgba(255,200,90,0.7)]" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M32 2 L35 12 L29 12 Z" fill="#ffc861" transform={`rotate(${i * 30} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="16" fill="#ffe08a" stroke="#ffb547" strokeWidth="2" />
    </svg>
  )
}

const ANN_ICON: Record<Announcement['kind'], string> = { night: '🌙', vote: '⚖️', hunter: '🏹', info: '📜' }

/** 座位下方的全宽舞台：当前阶段、公告与进度 */
export function Stage({ state }: { state: StateView }) {
  const g = state.game as GameView
  const isJudge = state.me.isJudge
  const night = isNight(g.phase)
  const dark = night || g.phase === 'dealt'
  const today = night ? [] : g.announcements.filter((a) => a.day === g.day)
  const myTurn =
    g.meAlive &&
    ((g.phase === 'wolf_wake' && g.myRole === 'werewolf') ||
      (g.phase === 'seer_wake' && g.myRole === 'seer') ||
      (g.phase === 'witch_wake' && g.myRole === 'witch'))
  const eyesOpenForMe =
    !!g.myRole &&
    g.meAlive &&
    ((g.myRole === 'werewolf' && ['wolf_wake', 'wolf_pick'].includes(g.phase) && g.wolf?.opened.includes(g.mySeat!)) ||
      (g.myRole === 'seer' && ['seer_wake', 'seer_pick', 'seer_result'].includes(g.phase) && g.seer?.opened) ||
      (g.myRole === 'witch' && ['witch_wake', 'witch_act'].includes(g.phase) && g.witch?.opened))
  const eyeColor = g.myRole === 'werewolf' ? '#ff3b30' : g.myRole === 'seer' ? '#8b5cf6' : '#34d399'

  const v = g.vote
  const confirmed = v ? v.voters.filter((s) => v.ballots[s]?.confirmed).length : 0
  const sub = dark ? 'text-gold-soft/70' : 'text-amber-900/70'

  return (
    <div className={cn('panel flex min-h-44 flex-1 flex-col p-4', !dark && 'panel-day')}>
      {/* 标题行 */}
      <div className="flex items-center gap-3">
        {dark ? <Moon /> : <Sun />}
        <div className="min-w-0 flex-1">
          <div className={cn('text-xs tracking-[0.3em]', sub)}>{g.phase === 'dealt' ? '准备阶段' : night ? `第 ${g.day} 夜` : `第 ${g.day} 天`}</div>
          <div key={g.phase} className={cn('animate-rise font-display text-2xl leading-tight', dark ? 'text-gold-grad' : 'text-amber-950')}>
            {PHASE_TITLE[g.phase]}
          </div>
        </div>
        {night && !isJudge && (
          <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
            {eyesOpenForMe ? <EyeOpen className="h-6 w-10" color={eyeColor} /> : <EyeClosed className="h-6 w-10 text-gold-soft/70" />}
            {eyesOpenForMe ? '已睁眼' : myTurn ? '轮到你' : g.meAlive ? '闭眼中' : '已出局'}
          </div>
        )}
      </div>

      <div className={cn('divider-ornament my-3 text-[10px]', !dark && 'text-amber-800')}>✦</div>

      {/* 内容区 */}
      <div className="flex flex-1 flex-col gap-2">
        {night && isJudge && <NightSummary g={g} />}
        {dark && !isJudge && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-gold-soft/70">
            {g.phase === 'dealt' ? '身份已发放，记住你的身份，等待法官宣布天黑' : !g.meAlive ? '你已出局，请保持安静' : myTurn ? '轮到你了，请点击下方「睁眼」' : eyesOpenForMe ? '请按提示完成操作' : '夜幕笼罩村庄，请安静等待…'}
          </div>
        )}
        {dark && isJudge && !night && <div className="flex flex-1 items-center justify-center text-sm text-gold-soft/70">所有身份已显示在座位上，准备好后宣布天黑</div>}

        {today.map((a, i) => (
          <div
            key={i}
            className={cn(
              'animate-rise flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-snug',
              a.seats.length ? 'bg-red-900/12 text-red-950 ring-1 ring-red-900/15' : 'bg-amber-900/8 text-amber-950 ring-1 ring-amber-900/10',
            )}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span className="text-base leading-none">{ANN_ICON[a.kind]}</span>
            <span className="flex-1">{a.text}</span>
          </div>
        ))}
        {!dark && today.length === 0 && <div className="flex flex-1 items-center justify-center text-sm text-amber-900/60">新的一天开始了</div>}

        {g.phase === 'voting' && v && (
          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-950/80">
              <span className="font-bold">{v.round > 1 ? 'PK 投票进行中' : '投票进行中'}</span>
              <span>
                已确认 {confirmed}/{v.voters.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-amber-900/15">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#f0c46c,#c98e33)] transition-all" style={{ width: `${(confirmed / v.voters.length) * 100}%` }} />
            </div>
          </div>
        )}
        {g.phase === 'vote_result' && v?.result && (
          <div className="mt-auto rounded-xl bg-amber-900/10 px-3 py-2 text-center text-sm font-bold text-amber-950">{v.result.note}</div>
        )}
      </div>
    </div>
  )
}

/** 法官夜间速览：今晚各角色的行动 */
function NightSummary({ g }: { g: GameView }) {
  const name = (s: number) => `${s + 1}号 ${g.players[s]?.user.name ?? ''}`
  const w = g.wolf
  const rows: [string, string, string][] = []
  rows.push([
    '🐺',
    '狼人',
    !w?.confirmed ? (g.phase === 'night_start' ? '尚未行动' : '行动中…') : w.target === 'none' ? '今晚不猎杀' : `猎杀 ${name(w.target as number)}`,
  ])
  if (g.hasSeer && g.seer) {
    const s = g.seer
    rows.push([
      '🔮',
      '预言家',
      !s.alive ? '已出局' : g.seerDone || s.result ? (s.selection !== null ? `查验 ${name(s.selection)}：${s.result === 'bad' ? '坏人 👎' : '好人 👍'}` : '已结束') : s.confirmed ? `查验 ${name(s.selection!)}` : '尚未行动',
    ])
  }
  if (g.hasWitch && g.witch) {
    const wi = g.witch
    const acts = [wi.saved && '使用解药', wi.poisoned !== null && `毒杀 ${name(wi.poisoned)}`].filter(Boolean).join('，')
    rows.push(['🧪', '女巫', !wi.alive ? '已出局' : wi.acted ? acts || '未用药' : '尚未行动'])
  }
  const deaths = g.players.filter((p) => p.pendingDeath).map((p) => name(p.seat))
  return (
    <div className="space-y-1.5 text-sm">
      {rows.map(([icon, role, text]) => (
        <div key={role} className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-1.5">
          <span>{icon}</span>
          <span className="w-12 text-gold-soft/80">{role}</span>
          <span className="flex-1 text-[#f3ead6]">{text}</span>
        </div>
      ))}
      <div className="px-1 pt-1 text-xs text-red-300">{deaths.length ? `目前将死亡：${deaths.join('、')}` : '目前无人死亡'}</div>
    </div>
  )
}
