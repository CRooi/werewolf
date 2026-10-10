import type { ReactNode } from 'react'
import type { Role } from '@shared/types'
import { cn } from '@/lib/utils'
import { ROLE_THEME, RoleEmblem } from '@/components/art/RoleArt'
import { Skull } from '@/components/art/icons'
import { roleLabel } from './RoleCard'

const HUES = [12, 32, 48, 140, 170, 200, 220, 260, 290, 320, 345]

export function avatarHue(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]!
}

export interface PlayerTokenProps {
  seat: number | null // 0-based；null 表示法官
  name?: string
  online?: boolean
  empty?: boolean
  dead?: boolean
  role?: Role | 'judge'
  me?: boolean
  selected?: boolean
  /** 选中颜色主题 */
  tone?: 'gold' | 'blood' | 'mystic' | 'moss'
  dim?: boolean
  /** 头像右上角状态（眼睛等） */
  status?: ReactNode
  /** 头像下方附加标记（投票者、狼爪等） */
  marks?: ReactNode
  /** 覆盖在头像上的大标记（今晚死亡等） */
  overlay?: ReactNode
  onClick?: () => void
  side?: 'left' | 'right'
}

const TONE: Record<NonNullable<PlayerTokenProps['tone']>, string> = {
  gold: 'ring-gold shadow-[0_0_18px_rgba(232,180,90,0.7)]',
  blood: 'ring-blood shadow-[0_0_18px_rgba(210,60,60,0.8)]',
  mystic: 'ring-mystic shadow-[0_0_18px_rgba(139,92,246,0.8)]',
  moss: 'ring-moss shadow-[0_0_18px_rgba(63,174,122,0.8)]',
}

/** 座位上的玩家：头像勋章 + 座位号 + 名字 */
export function PlayerToken(p: PlayerTokenProps) {
  const hue = p.name ? avatarHue(p.name) : 0
  const right = p.side === 'right'
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={!p.onClick}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-2xl border px-1.5 py-1.5 text-left transition',
        right && 'flex-row-reverse text-right',
        p.me ? 'border-gold/60 bg-gold/10' : 'border-white/5 bg-black/25',
        p.onClick && 'active:scale-[0.97]',
        p.dim && 'opacity-45',
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            'relative flex size-12 items-center justify-center overflow-hidden rounded-full ring-2 transition',
            p.selected ? TONE[p.tone ?? 'gold'] : 'ring-gold/40',
            p.empty && 'ring-dashed ring-white/20',
            p.dead && 'grayscale',
          )}
          style={
            p.empty
              ? { background: 'rgba(255,255,255,0.04)' }
              : p.role
                ? undefined
                : { background: `radial-gradient(circle at 35% 30%, hsl(${hue} 70% 62%), hsl(${hue} 55% 28%))` }
          }
        >
          {p.empty ? (
            <span className="text-xs text-white/30">空位</span>
          ) : p.role ? (
            <RoleEmblem role={p.role} className="size-full scale-[1.35] object-cover" />
          ) : (
            <span className="font-display text-xl text-white drop-shadow">{p.name?.slice(0, 1)}</span>
          )}
          {p.dead && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <Skull className="size-7 opacity-90" />
            </div>
          )}
          {p.overlay}
        </div>
        {/* 座位号徽章 */}
        <div
          className={cn(
            'absolute -top-1 flex size-5 items-center justify-center rounded-full border border-[#7a5418] bg-[linear-gradient(180deg,#ffe9b0,#c98e33)] font-display text-[11px] font-bold text-[#3a2305] shadow',
            right ? '-right-1' : '-left-1',
          )}
        >
          {p.seat === null ? '法' : p.seat + 1}
        </div>
        {p.status && <div className={cn('absolute -bottom-1', right ? '-left-1' : '-right-1')}>{p.status}</div>}
        {!p.empty && p.online === false && (
          <div className={cn('absolute bottom-0 size-3 rounded-full border-2 border-[#0a0e24] bg-zinc-500', right ? 'right-0' : 'left-0')} title="离线" />
        )}
      </div>
      <div className={cn('min-w-0 flex-1', right && 'flex flex-col items-end')}>
        <div className={cn('truncate text-sm leading-tight', p.dead ? 'text-white/40 line-through' : 'text-[#f3ead6]', p.empty && 'text-white/30')}>
          {p.empty ? `${(p.seat ?? 0) + 1}号` : p.name}
          {p.me && <span className="ml-1 text-[10px] text-gold">(我)</span>}
        </div>
        {p.role && (
          <div className="text-[11px] leading-tight" style={{ color: ROLE_THEME[p.role].accent }}>
            {roleLabel(p.role)}
          </div>
        )}
        {p.marks && <div className={cn('mt-0.5 flex flex-wrap gap-0.5', right && 'justify-end')}>{p.marks}</div>}
      </div>
    </button>
  )
}

/** 小号座位号标签（投票人、狼人选择等） */
export function SeatChip({ seat, variant = 'solid', tone = 'gold' }: { seat: number; variant?: 'solid' | 'dashed'; tone?: 'gold' | 'blood' | 'mystic' }) {
  const color = tone === 'blood' ? '#ff6b5e' : tone === 'mystic' ? '#b9a4ff' : '#e8b45a'
  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
      style={
        variant === 'solid'
          ? { background: color, color: '#1a1006' }
          : { border: `1px dashed ${color}`, color }
      }
    >
      {seat + 1}
    </span>
  )
}
