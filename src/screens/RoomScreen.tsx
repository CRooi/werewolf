import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Scenery } from '@/components/art/Scenery'
import { useRoomSocket } from '@/hooks/useRoomSocket'
import { tabKey, type Session } from '@/lib/session'
import { Lobby } from './Lobby'
import { GameScreen } from './game/GameScreen'

const DISMISS_KEY = tabKey('dismissed')

export function RoomScreen({ session, onExit }: { session: Session; onExit: () => void }) {
  const { state, status, send } = useRoomSocket(session, (reason) => {
    toast(reason)
    onExit()
  })
  // 已看过结果的对局 id：点“下一步”后回到房间
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY))

  if (!state) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-gold-soft">
        <Scenery night />
        <Loader2 className="size-8 animate-spin" />
        <span className="font-display text-lg">{status === 'closed' ? '连接断开，正在重连…' : '正在进入房间…'}</span>
        <button className="mt-6 text-xs text-muted-foreground underline" onClick={onExit}>
          返回首页
        </button>
      </div>
    )
  }

  const game = state.game
  const showGame = !!game && (state.room.inGame || dismissed !== game.id)
  if (showGame) {
    return (
      <GameScreen
        state={state}
        status={status}
        send={send}
        onDone={() => {
          sessionStorage.setItem(DISMISS_KEY, game!.id)
          setDismissed(game!.id)
        }}
      />
    )
  }
  return <Lobby state={state} status={status} send={send} />
}
