import { cn } from '@/lib/utils'
import type { ConnStatus } from '@/hooks/useRoomSocket'

export function ConnBadge({ status }: { status: ConnStatus }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className={cn('size-2 rounded-full', status === 'open' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'animate-pulse bg-amber-400')} />
      {status === 'open' ? '已连接' : '重连中'}
    </span>
  )
}
