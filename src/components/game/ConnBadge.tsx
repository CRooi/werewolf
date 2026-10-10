import { cn } from '@/lib/utils'
import type { ConnStatus } from '@/hooks/useRoomSocket'

export function ConnBadge({ status, className, dotClassName }: { status: ConnStatus; className?: string; dotClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-1 text-[11px] text-muted-foreground', className)}>
      <span className={cn('size-2 rounded-full', status === 'open' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'animate-pulse bg-amber-400', dotClassName)} />
      {status === 'open' ? '已连接' : '重连中'}
    </span>
  )
}
