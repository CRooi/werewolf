import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/** 固定种子的伪随机，保证星空每次渲染一致 */
function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function Stars() {
  const stars = useMemo(() => {
    const r = rand(42)
    return Array.from({ length: 70 }, () => ({
      x: r() * 400,
      y: r() * 420,
      s: r() * 1.3 + 0.3,
      d: r() * 4,
    }))
  }, [])
  return (
    <g>
      {stars.map((st, i) => (
        <circle
          key={i}
          cx={st.x}
          cy={st.y}
          r={st.s}
          fill="#fff"
          className="animate-twinkle"
          style={{ animationDelay: `${st.d}s` }}
        />
      ))}
    </g>
  )
}

function Pine({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  const w = h * 0.42
  return (
    <path
      d={`M${x} ${y - h} L${x + w * 0.45} ${y - h * 0.62} L${x + w * 0.25} ${y - h * 0.62} L${x + w * 0.7} ${y - h * 0.3} L${x + w * 0.4} ${y - h * 0.3} L${x + w} ${y} L${x - w} ${y} L${x - w * 0.4} ${y - h * 0.3} L${x - w * 0.7} ${y - h * 0.3} L${x - w * 0.25} ${y - h * 0.62} L${x - w * 0.45} ${y - h * 0.62} Z`}
      fill={fill}
    />
  )
}

function NightSky() {
  return (
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05071a" />
          <stop offset="0.5" stopColor="#111842" />
          <stop offset="0.85" stopColor="#2a2350" />
          <stop offset="1" stopColor="#120f2a" />
        </linearGradient>
        <radialGradient id="nmoon" cx="40%" cy="38%">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.7" stopColor="#f6e2b0" />
          <stop offset="1" stopColor="#d8b46a" />
        </radialGradient>
        <radialGradient id="nhalo">
          <stop offset="0" stopColor="#f6dca0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f6dca0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nfog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a86c8" stopOpacity="0" />
          <stop offset="1" stopColor="#8a86c8" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#nsky)" />
      <Stars />
      <circle cx="300" cy="120" r="110" fill="url(#nhalo)" />
      <circle cx="300" cy="120" r="46" fill="url(#nmoon)" />
      <circle cx="286" cy="108" r="7" fill="#e6cb8c" opacity="0.55" />
      <circle cx="314" cy="134" r="10" fill="#e6cb8c" opacity="0.45" />
      <circle cx="306" cy="98" r="4" fill="#e6cb8c" opacity="0.5" />
      {/* 远山 */}
      <path d="M0 640 L60 560 L110 600 L170 520 L240 590 L300 540 L360 600 L400 570 L400 800 L0 800 Z" fill="#1a1838" />
      <path d="M0 690 L50 640 L120 670 L190 620 L260 660 L330 630 L400 660 L400 800 L0 800 Z" fill="#110f28" />
      <rect y="600" width="400" height="200" fill="url(#nfog)" />
      {/* 松林 */}
      {[
        [10, 760, 120],
        [48, 770, 90],
        [80, 760, 140],
        [330, 765, 130],
        [362, 770, 100],
        [392, 760, 150],
      ].map(([x, y, h], i) => (
        <Pine key={i} x={x!} y={y!} h={h!} fill="#07081a" />
      ))}
      <path d="M0 760 Q200 730 400 760 L400 800 L0 800 Z" fill="#07081a" />
      {/* 狼的剪影 */}
      <g transform="translate(150 708) scale(0.9)" fill="#07081a">
        <path d="M0 52 L10 30 L14 12 L8 2 L16 6 L20 0 L22 10 L30 18 L36 30 L54 34 L70 40 L78 52 Z" />
      </g>
    </svg>
  )
}

function DaySky() {
  return (
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d6db5" />
          <stop offset="0.45" stopColor="#8fb8e0" />
          <stop offset="0.8" stopColor="#f6cf9a" />
          <stop offset="1" stopColor="#e8a86a" />
        </linearGradient>
        <radialGradient id="dsun">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.5" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#dsky)" />
      <circle cx="90" cy="130" r="90" fill="url(#dsun)" />
      <circle cx="90" cy="130" r="34" fill="#fff6d0" />
      {[
        [230, 110, 1],
        [60, 260, 0.8],
        [300, 300, 0.7],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity="0.85">
          <ellipse cx="0" cy="0" rx="46" ry="16" />
          <ellipse cx="-20" cy="-10" rx="22" ry="16" />
          <ellipse cx="14" cy="-14" rx="26" ry="20" />
        </g>
      ))}
      <path d="M0 620 Q100 560 200 600 T400 580 L400 800 L0 800 Z" fill="#6c9a5a" />
      <path d="M0 680 Q120 630 240 670 T400 660 L400 800 L0 800 Z" fill="#4f7d43" />
      {/* 村庄 */}
      {[
        [70, 640, 1],
        [140, 655, 0.8],
        [280, 640, 0.9],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-22 0 L0 -20 L22 0 Z" fill="#a24a2a" />
          <rect x="-18" y="0" width="36" height="24" fill="#f1dcb4" />
          <rect x="-5" y="10" width="10" height="14" fill="#7a4a2a" />
        </g>
      ))}
      {[
        [20, 770, 110],
        [370, 770, 120],
      ].map(([x, y, h], i) => (
        <Pine key={i} x={x!} y={y!} h={h!} fill="#2f5a2c" />
      ))}
      <path d="M0 740 Q200 710 400 740 L400 800 L0 800 Z" fill="#3a6a34" />
    </svg>
  )
}

/** 全屏场景背景：night 控制昼夜，切换时淡入淡出 */
export function Scenery({ night = true, dim = false }: { night?: boolean; dim?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#05071a]">
      <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', night ? 'opacity-100' : 'opacity-0')}>
        <NightSky />
      </div>
      <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', night ? 'opacity-0' : 'opacity-100')}>
        <DaySky />
      </div>
      <div className={cn('absolute inset-0 bg-black transition-opacity duration-700', dim ? 'opacity-45' : 'opacity-0')} />
    </div>
  )
}
