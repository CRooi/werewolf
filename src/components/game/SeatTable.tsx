import type { ReactNode } from 'react'

/** 左右两列座位；传入 center 时中间留出舞台列（经典“长桌”布局） */
export function SeatTable({ count, renderSeat, center }: { count: number; renderSeat: (seat: number, side: 'left' | 'right') => ReactNode; center?: ReactNode }) {
  const half = Math.ceil(count / 2)
  const left = Array.from({ length: half }, (_, i) => i)
  const right = Array.from({ length: count - half }, (_, i) => half + i)
  const col = (seats: number[], side: 'left' | 'right') => (
    <div className="flex flex-col gap-2">
      {seats.map((s) => (
        <div key={s}>{renderSeat(s, side)}</div>
      ))}
    </div>
  )
  if (!center) {
    return (
      <div className="grid grid-cols-2 gap-x-3">
        {col(left, 'left')}
        {col(right, 'right')}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
      {col(left, 'left')}
      <div className="flex min-h-full flex-col">{center}</div>
      {col(right, 'right')}
    </div>
  )
}
