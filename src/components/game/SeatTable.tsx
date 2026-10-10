import type { ReactNode } from 'react'

/** 经典“长桌”布局：左右两列座位，中间是舞台 */
export function SeatTable({ count, renderSeat, center }: { count: number; renderSeat: (seat: number, side: 'left' | 'right') => ReactNode; center: ReactNode }) {
  const half = Math.ceil(count / 2)
  const left = Array.from({ length: half }, (_, i) => i)
  const right = Array.from({ length: count - half }, (_, i) => half + i)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
      <div className="flex flex-col gap-2">{left.map((s) => <div key={s}>{renderSeat(s, 'left')}</div>)}</div>
      <div className="flex min-h-full flex-col">{center}</div>
      <div className="flex flex-col gap-2">{right.map((s) => <div key={s}>{renderSeat(s, 'right')}</div>)}</div>
    </div>
  )
}
