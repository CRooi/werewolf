import type { ReactNode } from 'react'
import type { Announcement, GameView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RoleEmblem } from '@/components/art/RoleArt'
import { Skull } from '@/components/art/icons'
import { RoleCard, roleLabel } from '@/components/game/RoleCard'

function FullScreen({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div
      className={cn('fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm animate-in fade-in', className)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

/** 发牌时翻开身份牌 */
export function IdentityReveal({ g, isJudge, onClose }: { g: GameView; isJudge: boolean; onClose: () => void }) {
  const role = isJudge ? 'judge' : (g.myRole ?? 'unknown')
  const mates = g.myRole === 'werewolf' ? g.players.filter((p) => p.role === 'werewolf' && p.seat !== g.mySeat) : []
  return (
    <FullScreen>
      <div className="text-sm tracking-[0.4em] text-gold-soft/80">{isJudge ? '本局你是' : '你的身份是'}</div>
      <RoleCard role={role} size="lg" flip />
      <div className="max-w-xs text-center text-sm text-gold-soft/80">
        {isJudge ? '所有人的身份已显示在座位上，点击“天黑请闭眼”开始游戏' : '请记住你的身份，不要让别人看到'}
      </div>
      {mates.length > 0 && (
        <div className="text-center text-sm text-red-300">你的狼同伴：{mates.map((p) => `${p.seat + 1}号 ${p.user.name}`).join('、')}</div>
      )}
      <Button variant="gold" size="xl" className="w-48" onClick={onClose}>
        我知道了
      </Button>
    </FullScreen>
  )
}

const ANN_TITLE: Record<Announcement['kind'], string> = { night: '天亮了', vote: '放逐结果', hunter: '一声枪响', info: '公告' }

/** 新公告：天亮死讯 / 投票结果 / 猎人开枪 */
export function AnnouncementOverlay({ items, g, onClose }: { items: Announcement[]; g: GameView; onClose: () => void }) {
  const a = items[0]!
  return (
    <FullScreen onClick={onClose}>
      <div className={cn('font-display text-5xl', a.kind === 'night' ? 'text-gold-grad' : a.kind === 'hunter' ? 'text-red-400' : 'text-gold-soft')}>
        {ANN_TITLE[a.kind]}
      </div>
      {items.map((it, i) => (
        <div key={i} className="animate-rise flex flex-col items-center gap-3" style={{ animationDelay: `${i * 0.2}s` }}>
          {it.seats.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {it.seats.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <div className="relative flex size-16 items-center justify-center rounded-full bg-black/60 ring-2 ring-red-500/70">
                    <Skull className="size-10" />
                  </div>
                  <span className="text-sm">
                    {s + 1}号 {g.players[s]?.user.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="text-center text-base text-[#f3ead6]">{it.text}</div>
        </div>
      ))}
      <div className="mt-6 text-xs text-muted-foreground">点击任意处关闭</div>
    </FullScreen>
  )
}

/** 公布结果：胜负 + 全员身份 */
export function ResultOverlay({
  g,
  onNext,
  onLog,
  onOpenChannel,
}: {
  g: GameView
  onNext: () => void
  onLog: () => void
  onOpenChannel: (c: 'wolf' | 'ghost') => void
}) {
  const wolfWin = g.winner === 'wolf'
  const me = g.mySeat !== null ? g.players[g.mySeat] : null
  const iWon = me?.role ? (me.role === 'werewolf') === wolfWin : null
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-black/80 px-4 pb-6 backdrop-blur-sm safe-top animate-in fade-in">
      <div className="mt-6 flex flex-col items-center">
        <div className={cn('relative size-28 overflow-hidden rounded-full ring-4', wolfWin ? 'ring-red-500/80' : 'ring-emerald-400/80')}>
          <RoleEmblem role={wolfWin ? 'werewolf' : 'villager'} className="size-full scale-125" />
        </div>
        <div className={cn('mt-3 font-display text-5xl', wolfWin ? 'text-red-400' : 'text-emerald-300')}>{wolfWin ? '狼人胜利' : '好人胜利'}</div>
        {iWon !== null && <div className="mt-1 font-display text-lg text-gold-soft">{iWon ? '🎉 你赢了！' : '惜败…'}</div>}
      </div>
      <div className="mx-auto mt-5 grid w-full max-w-md grid-cols-3 gap-2">
        {g.players.map((p) => (
          <div key={p.seat} className={cn('flex flex-col items-center gap-1 rounded-xl border p-1.5', p.role === 'werewolf' ? 'border-red-500/40 bg-red-950/30' : 'border-gold/20 bg-black/30')}>
            <RoleCard role={p.role ?? 'unknown'} size="sm" dead={!p.alive} className="w-14" />
            <div className="w-full truncate text-center text-xs">
              {p.seat + 1}号 {p.user.name}
            </div>
            <div className="text-[10px] text-muted-foreground">{p.alive ? '存活' : '出局'}</div>
          </div>
        ))}
      </div>
      {(g.wolf || g.ghostChat) && (
        <div className="mx-auto mt-6 flex w-full max-w-md gap-2">
          {g.wolf && (
            <Button variant="stone" size="lg2" className="flex-1 text-red-200" onClick={() => onOpenChannel('wolf')}>
              🐺 狼人频道（{g.wolf.chat.length}）
            </Button>
          )}
          {g.ghostChat && (
            <Button variant="stone" size="lg2" className="flex-1 text-purple-200" onClick={() => onOpenChannel('ghost')}>
              👁 观战频道（{g.ghostChat.length}）
            </Button>
          )}
        </div>
      )}
      <div className="mx-auto mt-3 flex w-full max-w-md gap-2">
        <Button variant="stone" size="xl" className="flex-1" onClick={onLog}>
          复盘
        </Button>
        <Button variant="gold" size="xl" className="flex-[2]" onClick={onNext}>
          下一步
        </Button>
      </div>
    </div>
  )
}

export function LogDialog({ g, open, onOpenChange }: { g: GameView; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel z-50 flex max-h-[80dvh] max-w-sm flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{g.judgeLog ? '完整记录' : '公告记录'}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto text-sm">
          {(g.judgeLog ?? g.announcements.map((a) => `第${a.day}天：${a.text}`)).map((line, i) => (
            <div key={i} className="rounded-lg bg-black/30 px-2.5 py-1.5">
              {line}
            </div>
          ))}
          {!g.judgeLog && g.announcements.length === 0 && <div className="py-6 text-center text-muted-foreground">暂无公告</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function MyRoleDialog({ g, isJudge, open, onOpenChange }: { g: GameView; isJudge: boolean; open: boolean; onOpenChange: (o: boolean) => void }) {
  const role = isJudge ? 'judge' : (g.myRole ?? 'unknown')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-xs flex-col items-center border-none bg-transparent shadow-none ring-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{roleLabel(role)}</DialogTitle>
        </DialogHeader>
        <RoleCard role={role} size="lg" flip className="w-56" />
        {g.seer && g.myRole === 'seer' && g.seer.history.length > 0 && (
          <div className="panel w-full space-y-1 p-3 text-sm">
            <div className="font-display text-gold-soft">查验记录</div>
            {g.seer.history.map((h, i) => (
              <div key={i}>
                第{h.day}夜：{h.seat + 1}号 {g.players[h.seat]?.user.name} {h.result === 'good' ? '👍 好人' : '👎 坏人'}
              </div>
            ))}
          </div>
        )}
        {g.witch && g.myRole === 'witch' && (
          <div className="panel w-full p-3 text-center text-sm">
            解药：{g.witch.antidote ? '可用' : '已用'} · 毒药：{g.witch.poison ? '可用' : '已用'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
