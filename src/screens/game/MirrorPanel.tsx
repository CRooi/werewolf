import type { ReactNode } from 'react'
import type { ClientMessage, GameView } from '@shared/types'
import { cn } from '@/lib/utils'
import { HunterPanel, IdiotPanel, SeerPanel, VoteBoard, WitchPanel, WolfChat, WolfPanel } from './ActionPanels'

/**
 * 上帝视角镜像：把正在行动的玩家看到的界面原样展示出来（只读、实时）。
 * 用于法官、出局玩家、观战席，以及后台的实时视角与回放。
 * isJudge 时法官可在夜间的狼人频道发言。
 */
export function MirrorPanel({ g, isJudge, send }: { g: GameView; isJudge?: boolean; send?: (m: ClientMessage) => void }) {
  const canChat = !!isJudge && !!send
  const frame = (title: string, tone: string, body: ReactNode) => (
    <div className={cn('space-y-3 rounded-2xl border bg-black/35 p-3', tone)}>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-display text-sm">{title}</span>
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> 实时画面
        </span>
      </div>
      {body}
    </div>
  )
  const waiting = (text: string) => <div className="py-4 text-center text-sm text-muted-foreground">{text}</div>

  switch (g.phase) {
    case 'wolf_wake': {
      const w = g.wolf
      if (!w) return null
      const opened = w.aliveSeats.filter((s) => w.opened.includes(s)).length
      return frame(
        '🐺 狼人视角',
        'border-blood/40 text-red-200',
        <>
          {waiting(`狼人正在睁眼 ${opened}/${w.aliveSeats.length}`)}
          <WolfChat g={g} send={canChat ? send : undefined} readOnly={!canChat} />
        </>,
      )
    }
    case 'wolf_pick':
      return g.wolf ? frame('🐺 狼人视角', 'border-blood/40 text-red-200', <WolfPanel g={g} send={send} mirror canChat={canChat} />) : null
    case 'seer_wake':
    case 'seer_pick':
    case 'seer_result': {
      const s = g.seer
      if (!s) return null
      if (!s.alive) return frame('🔮 预言家视角', 'border-mystic/40 text-purple-200', waiting('预言家已出局 · 法官空过流程'))
      if (g.phase === 'seer_wake') return frame('🔮 预言家视角', 'border-mystic/40 text-purple-200', waiting(s.opened ? '预言家已睁眼，等待法官让其查验' : '等待预言家睁眼…'))
      return frame('🔮 预言家视角', 'border-mystic/40 text-purple-200', <SeerPanel g={g} mirror />)
    }
    case 'witch_wake':
    case 'witch_act': {
      const w = g.witch
      if (!w) return null
      if (!w.alive) return frame('🧪 女巫视角', 'border-moss/40 text-emerald-200', waiting('女巫已出局 · 法官空过流程'))
      if (g.phase === 'witch_wake') return frame('🧪 女巫视角', 'border-moss/40 text-emerald-200', waiting(w.opened ? '女巫已睁眼，等待法官告知死亡信息' : '等待女巫睁眼…'))
      return frame('🧪 女巫视角', 'border-moss/40 text-emerald-200', <WitchPanel g={g} mirror />)
    }
    case 'hunter':
      return g.hunter ? frame('🏹 猎人视角', 'border-amber-500/40 text-amber-200', <HunterPanel g={g} mirror />) : null
    case 'idiot':
      return g.idiot ? frame('🃏 白痴视角', 'border-pink-500/40 text-pink-200', <IdiotPanel mirror seat={g.idiot.seat} />) : null
    case 'voting':
    case 'vote_result':
      return g.vote ? frame('⚖️ 投票视角', 'border-gold/40 text-gold-soft', <VoteBoard g={g} canVote={false} />) : null
    default:
      return null
  }
}
