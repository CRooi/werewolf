import type { GameView, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { EyeClosed, EyeOpen } from '@/components/art/icons'
import { PHASE_TITLE, isNight } from './helpers'

function Moon() {
  return (
    <svg viewBox="0 0 64 64" className="size-14 animate-float drop-shadow-[0_0_14px_rgba(246,220,160,0.6)]" aria-hidden>
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
    <svg viewBox="0 0 64 64" className="size-14 animate-[spin_30s_linear_infinite] drop-shadow-[0_0_14px_rgba(255,200,90,0.7)]" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M32 2 L35 12 L29 12 Z" fill="#ffc861" transform={`rotate(${i * 30} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="16" fill="#ffe08a" stroke="#ffb547" strokeWidth="2" />
    </svg>
  )
}

/** 桌面中央舞台：当前阶段的主视觉与公告 */
export function Stage({ state }: { state: StateView }) {
  const g = state.game as GameView
  const night = isNight(g.phase)
  const dark = night || g.phase === 'dealt'
  const last = g.announcements.filter((a) => a.day === g.day && !night)
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

  return (
    <div className={cn('panel flex flex-1 flex-col items-center gap-2 overflow-hidden p-2 text-center', !dark && 'panel-day')}>
      <div className={cn('text-[11px] tracking-[0.3em]', dark ? 'text-gold-soft/70' : 'text-amber-900/70')}>
        {g.phase === 'dealt' ? '准备' : night ? `第 ${g.day} 夜` : `第 ${g.day} 天`}
      </div>
      {dark ? <Moon /> : <Sun />}
      <div key={g.phase} className={cn('animate-rise font-display text-lg leading-snug', dark ? 'text-gold-grad' : 'text-amber-950')}>
        {PHASE_TITLE[g.phase]}
      </div>
      {night && !state.me.isJudge && (
        <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
          {eyesOpenForMe ? <EyeOpen className="h-5 w-8" color={g.myRole === 'werewolf' ? '#ff3b30' : g.myRole === 'seer' ? '#8b5cf6' : '#34d399'} /> : <EyeClosed className="h-5 w-8 text-gold-soft/70" />}
          {eyesOpenForMe ? '你已睁眼' : myTurn ? '轮到你了' : g.meAlive ? '闭眼中…' : '你已出局'}
        </div>
      )}
      {!night && last.length > 0 && (
        <div className="w-full space-y-1.5">
          {last.map((a, i) => (
            <div key={i} className={cn('rounded-lg px-1.5 py-1 text-xs leading-snug', a.seats.length ? 'bg-red-900/15 text-red-950' : 'bg-amber-900/10 text-amber-950')}>
              {a.text}
            </div>
          ))}
        </div>
      )}
      {g.phase === 'voting' && g.vote && (
        <div className="text-xs text-amber-950/80">
          {g.vote.round > 1 && <div className="font-bold">PK 投票</div>}
          已确认 {g.vote.voters.filter((s) => g.vote!.ballots[s]?.confirmed).length}/{g.vote.voters.length}
        </div>
      )}
      {g.phase === 'vote_result' && g.vote?.result && <div className="text-xs font-bold text-amber-950">{g.vote.result.note}</div>}
    </div>
  )
}
