import type { Role } from '@shared/types'
import { useId } from 'react'

export type ArtRole = Role | 'judge' | 'unknown'

/** 角色主题色：卡面背景渐变 + 强调色 */
export const ROLE_THEME: Record<ArtRole, { from: string; to: string; accent: string }> = {
  werewolf: { from: '#5a1218', to: '#12060a', accent: '#ff5a4e' },
  seer: { from: '#3b2a8a', to: '#0d0b2a', accent: '#b9a4ff' },
  witch: { from: '#1f5a46', to: '#06140f', accent: '#7ef0b8' },
  hunter: { from: '#7a4a1c', to: '#1a0f06', accent: '#ffbf6b' },
  villager: { from: '#2e5a8a', to: '#0a1626', accent: '#9fd3ff' },
  judge: { from: '#8a6420', to: '#1e1406', accent: '#ffe08a' },
  unknown: { from: '#2a2f55', to: '#0c0f24', accent: '#e8b45a' },
}

/** 每个角色的纹章插画（120x150 画布） */
export function RoleEmblem({ role, className }: { role: ArtRole; className?: string }) {
  const id = useId().replace(/:/g, '')
  const t = ROLE_THEME[role]
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
        <radialGradient id={`moon${id}`} cx="40%" cy="35%">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.6" stopColor="#f6dca0" />
          <stop offset="1" stopColor="#c99a4a" />
        </radialGradient>
        <radialGradient id={`ball${id}`} cx="38%" cy="32%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#c4b5fd" stopOpacity="0.85" />
          <stop offset="1" stopColor="#4c1d95" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id={`halo${id}`}>
          <stop offset="0" stopColor={t.accent} stopOpacity="0.55" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0" />
        </radialGradient>
        <filter id={`glow${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="120" height="150" fill={`url(#bg${id})`} />
      {/* 星点 */}
      {[
        [14, 18, 1.2],
        [100, 14, 1],
        [22, 60, 0.8],
        [104, 70, 1.3],
        [88, 32, 0.7],
        [10, 110, 0.9],
        [110, 120, 0.8],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.7} />
      ))}
      <circle cx="60" cy="72" r="52" fill={`url(#halo${id})`} />
      {role === 'werewolf' && <Wolf id={id} />}
      {role === 'seer' && <Seer id={id} />}
      {role === 'witch' && <Witch id={id} />}
      {role === 'hunter' && <Hunter id={id} />}
      {role === 'villager' && <Villager />}
      {role === 'judge' && <Judge />}
      {role === 'unknown' && <Unknown />}
    </svg>
  )
}

function Wolf({ id }: { id: string }) {
  return (
    <g>
      <circle cx="60" cy="52" r="30" fill={`url(#moon${id})`} opacity="0.95" />
      <circle cx="50" cy="44" r="4" fill="#d9b670" opacity="0.5" />
      <circle cx="68" cy="60" r="6" fill="#d9b670" opacity="0.4" />
      {/* 狼头 */}
      <path
        d="M24 40 L46 64 L74 64 L96 40 L92 80 L104 92 L84 104 L78 118 L66 124 L60 134 L54 124 L42 118 L36 104 L16 92 L28 80 Z"
        fill="#140a0e"
        stroke="#3a1a20"
        strokeWidth="1.2"
      />
      {/* 耳内 */}
      <path d="M30 48 L44 66 L38 70 Z" fill="#3a1418" />
      <path d="M90 48 L76 66 L82 70 Z" fill="#3a1418" />
      {/* 额纹 */}
      <path d="M60 70 L56 84 L60 96 L64 84 Z" fill="#2a1216" />
      {/* 眼睛 */}
      <g filter={`url(#glow${id})`}>
        <path d="M38 86 L54 90 L42 94 Z" fill="#ff3b30" />
        <path d="M82 86 L66 90 L78 94 Z" fill="#ff3b30" />
      </g>
      {/* 鼻子 + 獠牙 */}
      <path d="M54 118 L66 118 L60 125 Z" fill="#000" />
      <path d="M50 124 L53 132 L55 125 Z M70 124 L67 132 L65 125 Z" fill="#f3ead6" />
    </g>
  )
}

function Seer({ id }: { id: string }) {
  return (
    <g>
      <ellipse cx="60" cy="130" rx="34" ry="7" fill="#000" opacity="0.4" />
      <path d="M32 128 Q60 106 88 128 L82 138 L38 138 Z" fill="#6b4a2b" stroke="#c89a5a" strokeWidth="1" />
      <path d="M40 132 L80 132" stroke="#c89a5a" strokeWidth="1" opacity="0.6" />
      <circle cx="60" cy="80" r="36" fill={`url(#ball${id})`} stroke="#e9ddff" strokeOpacity="0.5" />
      {/* 球中之眼 */}
      <g filter={`url(#glow${id})`}>
        <path d="M38 82 Q60 62 82 82 Q60 102 38 82 Z" fill="#f5f0ff" />
        <circle cx="60" cy="82" r="9" fill="#6d28d9" />
        <circle cx="60" cy="82" r="4" fill="#0b0620" />
        <circle cx="63" cy="79" r="1.8" fill="#fff" />
      </g>
      <ellipse cx="46" cy="62" rx="9" ry="5" fill="#fff" opacity="0.35" transform="rotate(-30 46 62)" />
      {/* 闪光 */}
      {[
        [22, 40, 5],
        [98, 46, 4],
        [94, 108, 3],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`}
          fill="#e9ddff"
        />
      ))}
    </g>
  )
}

function Witch({ id }: { id: string }) {
  return (
    <g>
      {/* 帽子 */}
      <path d="M58 12 C70 10 84 18 90 10 C86 24 76 26 72 36 L84 72 L34 72 L48 40 C52 28 52 18 58 12 Z" fill="#241338" stroke="#5b3a85" strokeWidth="1.2" />
      <ellipse cx="60" cy="74" rx="46" ry="9" fill="#1a0d2a" stroke="#5b3a85" strokeWidth="1.2" />
      <path d="M38 62 L82 62 L84 70 L36 70 Z" fill="#7c3aed" />
      <rect x="54" y="61" width="12" height="10" rx="1.5" fill="none" stroke="#ffd66b" strokeWidth="2" />
      {/* 解药 */}
      <g filter={`url(#glow${id})`}>
        <rect x="31" y="92" width="10" height="10" rx="2" fill="#c8a978" />
        <rect x="29" y="88" width="14" height="5" rx="2" fill="#8b5a2b" />
        <circle cx="36" cy="117" r="17" fill="#d6fff0" fillOpacity="0.25" stroke="#d6fff0" strokeOpacity="0.6" />
        <path d="M20 118 A16 16 0 0 0 52 118 Z" fill="#34d399" />
        <circle cx="30" cy="120" r="2" fill="#ecfdf5" />
        <circle cx="40" cy="125" r="1.4" fill="#ecfdf5" />
      </g>
      {/* 毒药 */}
      <g filter={`url(#glow${id})`}>
        <rect x="78" y="86" width="10" height="12" rx="2" fill="#c8a978" />
        <rect x="76" y="82" width="14" height="5" rx="2" fill="#4a2a5a" />
        <path d="M74 98 L92 98 L96 134 L70 134 Z" fill="#a855f7" fillOpacity="0.85" stroke="#e9d5ff" strokeOpacity="0.5" />
        {/* 骷髅 */}
        <circle cx="83" cy="113" r="6" fill="#f5f0ff" />
        <rect x="79.5" y="117" width="7" height="4" rx="1" fill="#f5f0ff" />
        <circle cx="81" cy="112.5" r="1.6" fill="#4c1d95" />
        <circle cx="85" cy="112.5" r="1.6" fill="#4c1d95" />
      </g>
    </g>
  )
}

function Hunter({ id }: { id: string }) {
  return (
    <g>
      {/* 准星 */}
      <g stroke="#ffbf6b" strokeOpacity="0.55" fill="none" strokeWidth="1.5">
        <circle cx="60" cy="78" r="40" />
        <circle cx="60" cy="78" r="26" strokeDasharray="4 4" />
        <path d="M60 30 L60 46 M60 110 L60 126 M12 78 L28 78 M92 78 L108 78" />
      </g>
      {/* 弓 */}
      <path d="M30 40 Q96 30 92 112" fill="none" stroke="#8b5a2b" strokeWidth="6" strokeLinecap="round" />
      <path d="M30 40 Q96 30 92 112" fill="none" stroke="#d9a05b" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 40 L92 112" stroke="#f3ead6" strokeWidth="1" opacity="0.8" />
      {/* 箭 */}
      <g filter={`url(#glow${id})`}>
        <path d="M26 128 L94 44" stroke="#f3ead6" strokeWidth="3" strokeLinecap="round" />
        <path d="M100 36 L86 44 L94 52 Z" fill="#ffd27a" />
        <path d="M26 128 L18 126 L22 118 L30 122 Z M30 124 L24 134 L32 132 Z" fill="#e5484d" />
      </g>
    </g>
  )
}

function Villager() {
  return (
    <g>
      {/* 山丘 */}
      <path d="M0 120 Q30 100 60 112 T120 104 L120 150 L0 150 Z" fill="#0d2238" />
      {/* 房屋 */}
      <path d="M30 76 L60 48 L90 76 Z" fill="#7a3b22" stroke="#c46b3d" strokeWidth="1.5" />
      <rect x="36" y="76" width="48" height="40" fill="#d8b98a" stroke="#8b6a3e" strokeWidth="1.5" />
      <rect x="72" y="52" width="8" height="16" fill="#5a3a22" />
      <rect x="54" y="92" width="12" height="24" rx="1" fill="#5a3a22" />
      <rect x="40" y="84" width="11" height="11" fill="#ffd66b" stroke="#8b6a3e" />
      <rect x="69" y="84" width="11" height="11" fill="#ffd66b" stroke="#8b6a3e" />
      <path d="M45.5 84 L45.5 95 M40 89.5 L51 89.5 M74.5 84 L74.5 95 M69 89.5 L80 89.5" stroke="#8b6a3e" strokeWidth="1" />
      {/* 炊烟 */}
      <path d="M76 48 Q70 40 78 34 Q86 28 80 20" fill="none" stroke="#cfe6ff" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" />
      {/* 麦穗 */}
      {[16, 24, 98, 106].map((x, i) => (
        <g key={i} stroke="#f0c46c" strokeWidth="1.5" fill="#f0c46c">
          <path d={`M${x} 140 L${x} 112`} />
          <ellipse cx={x - 2.5} cy={116} rx="2.2" ry="3.5" />
          <ellipse cx={x + 2.5} cy={120} rx="2.2" ry="3.5" />
          <ellipse cx={x - 2.5} cy={124} rx="2.2" ry="3.5" />
          <ellipse cx={x} cy={111} rx="2" ry="3" />
        </g>
      ))}
    </g>
  )
}

function Judge() {
  return (
    <g>
      {/* 天平 */}
      <path d="M60 30 L60 112" stroke="#ffe08a" strokeWidth="3" />
      <circle cx="60" cy="28" r="5" fill="#ffe08a" />
      <path d="M24 46 L96 46" stroke="#ffe08a" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 46 L12 80 M24 46 L36 80 M96 46 L84 80 M96 46 L108 80" stroke="#ffe08a" strokeWidth="1" />
      <path d="M8 80 Q24 94 40 80 Z" fill="#c99a3a" stroke="#ffe08a" />
      <path d="M80 80 Q96 94 112 80 Z" fill="#c99a3a" stroke="#ffe08a" />
      <path d="M42 112 L78 112 L84 122 L36 122 Z" fill="#8a6420" stroke="#ffe08a" />
      {/* 法槌 */}
      <g transform="rotate(-30 64 128)">
        <rect x="44" y="118" width="40" height="14" rx="4" fill="#6b3e1a" stroke="#ffe08a" />
        <rect x="62" y="132" width="5" height="22" fill="#6b3e1a" />
      </g>
    </g>
  )
}

function Unknown() {
  return (
    <g>
      <circle cx="60" cy="72" r="34" fill="none" stroke="#e8b45a" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx="60" cy="72" r="26" fill="none" stroke="#e8b45a" strokeOpacity="0.35" strokeDasharray="3 5" />
      <text x="60" y="88" textAnchor="middle" fontSize="44" fill="#e8b45a" fontFamily="serif">
        ?
      </text>
    </g>
  )
}
