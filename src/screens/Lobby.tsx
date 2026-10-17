import { useState } from 'react'
import { ArrowLeftRight, Copy, Eye, History, LogOut, Play, Settings2, Shuffle, Trash2, UserX, X } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_SPECTATORS, ROLE_NAME, ROLE_ORDER, seatCount, type ClientMessage, type RoomConfig, type StateView, type UserBrief } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Scenery } from '@/components/art/Scenery'
import { ConfigForm } from '@/components/game/ConfigForm'
import { ConnBadge } from '@/components/game/ConnBadge'
import { PlayerToken } from '@/components/game/PlayerToken'
import { RoleCard } from '@/components/game/RoleCard'
import { SeatTable } from '@/components/game/SeatTable'
import { WatchBanner } from '@/components/game/WatchBanner'
import type { ConnStatus } from '@/hooks/useRoomSocket'

interface Props {
  state: StateView
  status: ConnStatus
  send: (m: ClientMessage) => void
  /** 有已结束的上一局时，可回看结果与频道记录 */
  onReview?: () => void
}

export function Lobby({ state, status, send, onReview }: Props) {
  const { me, room } = state
  const [target, setTarget] = useState<{ user: UserBrief; seat: number | null } | null>(null)
  const [editing, setEditing] = useState<RoomConfig | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  const filled = room.seats.filter(Boolean).length
  const total = room.seats.length
  const full = filled === total
  const incoming = room.swaps.find((s) => s.to.id === me.id)
  const outgoing = room.swaps.find((s) => s.from.id === me.id)

  const share = async () => {
    const url = `${location.origin}/?room=${room.code}`
    const text = `来玩狼人杀！房间码 ${room.code}\n${url}`
    try {
      if (navigator.share) await navigator.share({ title: '狼人杀', text, url })
      else {
        await navigator.clipboard.writeText(text)
        toast.success('邀请链接已复制')
      }
    } catch {
      /* 用户取消分享 */
    }
  }

  const tapSeat = (seat: number) => {
    if (me.isSpectator) return
    const u = room.seats[seat]
    if (!u) {
      if (me.isJudge) return toast('法官需要与玩家交换位置才能入座')
      return send({ type: 'sit', seat })
    }
    if (u.id === me.id) return
    setTarget({ user: u, seat })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-3 safe-top safe-bottom">
      <Scenery night dim />
      {me.isSpectator && <WatchBanner />}
      {/* 顶栏 */}
      <header className="flex items-center justify-between py-2">
        <button onClick={() => setConfirmExit(true)} className="flex items-center gap-1 text-xs text-muted-foreground">
          <LogOut className="size-4" /> {me.isJudge ? '解散' : me.isSpectator ? '退出观战' : '退出'}
        </button>
        <div className="flex items-center gap-3">
          {onReview && (
            <button onClick={onReview} className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-gold-soft">
              <History className="size-3.5" /> 回看上一局
            </button>
          )}
          <ConnBadge status={status} />
        </div>
      </header>

      <button onClick={share} className="panel mx-auto mb-3 flex items-center gap-3 px-5 py-2 active:scale-95 transition">
        <span className="text-xs text-muted-foreground">房间码</span>
        <span className="font-display text-3xl tracking-[0.25em] text-gold-grad">{room.code}</span>
        <Copy className="size-4 text-gold" />
      </button>

      <SeatTable
        count={total}
        renderSeat={(seat, side) => {
          const u = room.seats[seat]
          return (
            <PlayerToken
              seat={seat}
              side={side}
              empty={!u}
              name={u?.name}
              online={u?.online}
              role={u ? (room.rolePreview?.[seat] ?? undefined) : undefined}
              me={u?.id === me.id}
              selected={!!u && (outgoing?.to.id === u.id || incoming?.from.id === u.id)}
              onClick={me.isSpectator ? undefined : () => tapSeat(seat)}
            />
          )
        }}
      />

      {/* 法官与板子信息 */}
      <div className="panel mt-3 flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <button
            className="flex shrink-0 items-center gap-3 text-left active:scale-95 transition"
            onClick={() => room.judge.id !== me.id && !me.isSpectator && setTarget({ user: room.judge, seat: null })}
          >
            <RoleCard role="judge" size="sm" className="w-14" />
            <div>
              <div className="text-xs tracking-widest text-gold-soft/70">法官</div>
              <div className="max-w-32 truncate font-display text-xl">
                {room.judge.name}
                {me.isJudge && <span className="ml-1 font-sans text-xs text-gold">(我)</span>}
              </div>
              {!room.judge.online && <div className="text-[11px] text-muted-foreground">离线</div>}
            </div>
          </button>
          <div className="ml-auto text-right">
            <div className="font-display text-4xl leading-none text-gold-grad">
              {filled}/{total}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{full ? '人已到齐' : '等待玩家入座'}</div>
          </div>
        </div>
        <div className="divider-ornament text-[10px]">✦ 本局板子 ✦</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {ROLE_ORDER.filter((r) => room.config[r] > 0).map((r) => (
            <span key={r} className="rounded-full border border-gold/20 bg-black/40 px-3 py-1 text-sm text-gold-soft">
              {ROLE_NAME[r]} × {room.config[r]}
            </span>
          ))}
        </div>
        {room.config.witch > 0 && (
          <div className="text-center text-xs text-muted-foreground">
            女巫：{room.config.witchBothSameNight ? '解药毒药可同晚使用' : '每晚只能使用一瓶药'} · {room.config.witchSelfSave ? '第一晚可以自救' : '不能自救'}
          </div>
        )}
        {room.config.allowSpectators && (
          <div className="rounded-xl bg-black/25 px-3 py-2">
            <div className="mb-1.5 text-xs text-gold-soft/70">
              观战席 {room.spectators.length}/{MAX_SPECTATORS}
            </div>
            {room.spectators.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无观战者，输入房间码后选择「观战」即可加入</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {room.spectators.map((u) => (
                  <span key={u.id} className={cn('flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-xs', !u.online && 'opacity-50')}>
                    <Eye className="size-3 text-gold-soft/70" />
                    {u.name}
                    {u.id === me.id && <span className="text-gold">(我)</span>}
                    {me.isJudge && (
                      <button className="ml-0.5 text-red-300" onClick={() => send({ type: 'kick', userId: u.id })} aria-label={`请出观战者 ${u.name}`}>
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {!me.isSpectator && (
          <p className="mt-auto text-center text-xs text-muted-foreground">
            <ArrowLeftRight className="mr-1 inline size-3" />
            点击空位换座，点击其他玩家或法官头像可请求交换位置
          </p>
        )}
      </div>

      {outgoing && (
        <div className="panel mt-3 flex items-center justify-between px-3 py-2 text-sm">
          <span>等待 {outgoing.to.name} 同意交换…</span>
          <Button size="sm" variant="ghost" onClick={() => send({ type: 'swapCancel', id: outgoing.id })}>
            取消
          </Button>
        </div>
      )}

      {me.isJudge ? (
        <>
          {room.rolePreview && (
            <div className="mt-3 text-center text-xs text-gold-soft/80">已刷出身份，玩家看不到，开始游戏将按此发牌</div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="stone" size="xl" className="px-4" onClick={() => setEditing(room.config)} aria-label="修改板子">
              <Settings2 />
            </Button>
            <Button variant="mystic" size="xl" className="px-4" disabled={!full} onClick={() => send({ type: 'shuffleRoles' })}>
              <Shuffle /> {room.rolePreview ? '再刷一次' : '刷新身份'}
            </Button>
            <Button variant="gold" size="xl" className="flex-1" disabled={!full} onClick={() => send({ type: 'start' })}>
              <Play /> {full ? '开始游戏' : `还差 ${total - filled} 人`}
            </Button>
          </div>
        </>
      ) : (
        <div className="panel mt-4 py-3 text-center font-display text-gold-soft/80">{me.isSpectator ? '你在观战席，等待法官开始游戏…' : '等待法官开始游戏…'}</div>
      )}

      {/* 点击玩家 */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="panel max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {target?.seat === null ? '法官' : `${(target?.seat ?? 0) + 1}号`} · {target?.user.name}
            </DialogTitle>
            <DialogDescription>
              {target?.seat === null ? '交换后你将成为法官，法官回到你的座位成为玩家' : me.isJudge ? '交换后对方成为法官，你成为该座位的玩家' : '对方同意后即可交换'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="gold"
              size="lg2"
              onClick={() => {
                send({ type: 'swapRequest', to: target!.user.id })
                setTarget(null)
              }}
            >
              <ArrowLeftRight /> 请求交换位置
            </Button>
            {me.isJudge && target?.seat !== null && (
              <Button
                variant="destructive"
                size="lg2"
                onClick={() => {
                  send({ type: 'kick', userId: target!.user.id })
                  setTarget(null)
                }}
              >
                <UserX /> 请出房间
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 收到交换请求 */}
      <AlertDialog open={!!incoming}>
        <AlertDialogContent className="panel max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">交换位置请求</AlertDialogTitle>
            <AlertDialogDescription>
              {incoming &&
                (incoming.from.id === room.judge.id
                  ? `法官 ${incoming.from.name} 想和你交换位置，同意后你将成为法官`
                  : me.isJudge
                    ? `${incoming.from.name} 想成为法官，同意后你将坐到 Ta 的位置成为玩家`
                    : `${incoming.from.name} 想和你交换位置`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => send({ type: 'swapRespond', id: incoming!.id, accept: false })}>拒绝</AlertDialogCancel>
            <AlertDialogAction onClick={() => send({ type: 'swapRespond', id: incoming!.id, accept: true })}>同意</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 修改配置 */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="panel flex max-h-[90dvh] max-w-sm flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">修改板子</DialogTitle>
            <DialogDescription>座位数将变为 {editing ? seatCount(editing) : 0}</DialogDescription>
          </DialogHeader>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{editing && <ConfigForm value={editing} onChange={setEditing} />}</div>
          <Button
            variant="gold"
            size="lg2"
            onClick={() => {
              send({ type: 'updateConfig', config: editing! })
              setEditing(null)
            }}
          >
            保存
          </Button>
        </DialogContent>
      </Dialog>

      {/* 退出 / 解散 */}
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent className="panel max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">{me.isJudge ? '解散房间？' : me.isSpectator ? '退出观战？' : '退出房间？'}</AlertDialogTitle>
            <AlertDialogDescription>{me.isJudge ? '所有玩家都会被请出房间' : me.isSpectator ? '你将离开观战席' : '你的座位将被空出'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => send({ type: me.isJudge ? 'disband' : 'leave' })}>
              {me.isJudge ? <Trash2 /> : <LogOut />} {me.isJudge ? '解散' : '退出'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
