import { cn } from '@/lib/utils'

type P = { className?: string }

/** 睁开的眼睛 */
export function EyeOpen({ className, color = '#ff3b30' }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} aria-hidden>
      <path d="M2 10 Q16 -4 30 10 Q16 24 2 10 Z" fill="#fff8ec" stroke="#2a1a05" strokeWidth="1.2" />
      <circle cx="16" cy="10" r="5.5" fill={color} />
      <circle cx="16" cy="10" r="2.4" fill="#0b0620" />
      <circle cx="17.6" cy="8.4" r="1.2" fill="#fff" />
    </svg>
  )
}

/** 闭上的眼睛（带睫毛） */
export function EyeClosed({ className }: P) {
  return (
    <svg viewBox="0 0 32 20" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7 Q16 18 29 7" />
      <path d="M8 11.5 L6 15 M13 13.5 L12 17.5 M19 13.5 L20 17.5 M24 11.5 L26 15" />
    </svg>
  )
}

export function Skull({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2 C6.5 2 3 5.8 3 10.5 C3 13.4 4.4 15.4 6.5 16.5 L6.5 19.5 C6.5 20.6 7.4 21.5 8.5 21.5 L15.5 21.5 C16.6 21.5 17.5 20.6 17.5 19.5 L17.5 16.5 C19.6 15.4 21 13.4 21 10.5 C21 5.8 17.5 2 12 2 Z" fill="#e9e3d3" />
      <circle cx="8.6" cy="11" r="2.4" fill="#1a1426" />
      <circle cx="15.4" cy="11" r="2.4" fill="#1a1426" />
      <path d="M12 13.5 L10.8 16 L13.2 16 Z" fill="#1a1426" />
      <path d="M9.5 18.5 L9.5 21.5 M12 18.5 L12 21.5 M14.5 18.5 L14.5 21.5" stroke="#1a1426" strokeWidth="1" />
    </svg>
  )
}

/** 狼爪印：狼人选择标记 */
export function Paw({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <ellipse cx="12" cy="16" rx="5.5" ry="4.5" />
      <ellipse cx="5.5" cy="10" rx="2.2" ry="3" />
      <ellipse cx="9.5" cy="6" rx="2.2" ry="3" />
      <ellipse cx="14.5" cy="6" rx="2.2" ry="3" />
      <ellipse cx="18.5" cy="10" rx="2.2" ry="3" />
    </svg>
  )
}

export function Crosshair({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 1 L12 7 M12 17 L12 23 M1 12 L7 12 M17 12 L23 12" />
    </svg>
  )
}

export function Potion({ className, color }: P & { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="9" y="2" width="6" height="3" rx="1" fill="#8b5a2b" />
      <rect x="10" y="5" width="4" height="4" fill="#c8a978" />
      <circle cx="12" cy="15" r="7.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />
      <path d="M5 15.5 A7 7 0 0 0 19 15.5 Z" fill={color} />
      <circle cx="9.5" cy="16.5" r="1" fill="#fff" />
    </svg>
  )
}

/** 首页 Logo：满月下嚎叫的狼 */
export function Logo({ className }: P) {
  return (
    <svg viewBox="0 0 200 200" className={cn('drop-shadow-[0_0_30px_rgba(246,220,160,0.35)]', className)} aria-hidden>
      <defs>
        <radialGradient id="lmoon" cx="40%" cy="35%">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.65" stopColor="#f6dca0" />
          <stop offset="1" stopColor="#c99a4a" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="92" r="74" fill="url(#lmoon)" />
      <circle cx="74" cy="70" r="10" fill="#e3c27e" opacity="0.5" />
      <circle cx="128" cy="110" r="15" fill="#e3c27e" opacity="0.45" />
      <circle cx="120" cy="56" r="6" fill="#e3c27e" opacity="0.5" />
      {/* 山崖 */}
      <path d="M0 200 L0 170 L40 150 L80 156 L120 140 L150 150 L200 168 L200 200 Z" fill="#07081a" />
      {/* 嚎叫的狼 */}
      <g fill="#07081a">
        <path d="M122 152 C124 136 118 124 112 116 C108 108 106 100 104 92 C104 86 102 80 100 76 L101 60 L94 71 C90 69 87 69 84 70 L62 49 L67 57 L65 59 L76 65 L72 66 L80 73 C82 80 84 86 86 92 C82 100 80 108 80 118 L78 150 L86 150 L88 128 C94 138 102 146 110 152 Z" />
        <path d="M118 152 C130 150 140 146 146 136 C142 148 132 155 118 155 Z" />
      </g>
    </svg>
  )
}
