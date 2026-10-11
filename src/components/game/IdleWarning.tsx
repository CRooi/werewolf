import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import type { ClientMessage, RoomView } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 房间长时间无操作时的解散提醒：倒计时结束前任何人点击「延长对局」，房间重新开始计时。
 * 截止时间按收到状态时的本地时钟推算，避免与服务器时钟不一致。
 */
export function IdleWarning({ room, receivedAt, send }: { room: RoomView; receivedAt: number; send: (m: ClientMessage) => void }) {
  const deadline = receivedAt + room.idleRemainingMs
  const [now, setNow] = useState(receivedAt)
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const remaining = deadline - now
  const open = remaining <= room.idleWarnMs && dismissedFor !== deadline

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="panel max-w-xs">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display text-xl">
            <Hourglass className="size-5 text-gold" /> 房间即将解散
          </AlertDialogTitle>
          <AlertDialogDescription>房间长时间没有任何操作，倒计时结束后将自动解散。任何人点击「延长对局」即可重新开始计时。</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2 text-center font-display text-5xl tabular-nums text-gold-grad">{fmt(remaining)}</div>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="gold" size="lg2" onClick={() => send({ type: 'extend' })}>
            延长对局
          </Button>
          <Button variant="ghost" size="lg2" onClick={() => setDismissedFor(deadline)}>
            知道了
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
