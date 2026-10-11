import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff, LogOut, ScrollText, Square } from 'lucide-react'
import type { Announcement, ClientMessage, GameView, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { EyeClosed, EyeOpen, Paw } from '@/components/art/icons'
import { ConnBadge } from '@/components/game/ConnBadge'
import { PlayerToken, SeatChip } from '@/components/game/PlayerToken'
import { RoleCard } from '@/components/game/RoleCard'
import { SeatTable } from '@/components/game/SeatTable'
import { WatchBanner } from '@/components/game/WatchBanner'
import type { ConnStatus } from '@/hooks/useRoomSocket'
import { tabKey } from '@/lib/session'
import { ChatBox, HunterPanel, IdiotPanel, SeerPanel, VoteBoard, WitchPanel, WolfPanel } from './ActionPanels'
import { isNight, pendingAction, vibrate, type ActionKind } from './helpers'
import { JudgeDock } from './JudgeDock'
import { AnnouncementOverlay, IdentityReveal, LogDialog, MyRoleDialog, ResultOverlay } from './Overlays'
import { Stage } from './Stage'

interface Props {
  state: StateView
  status: ConnStatus
  send: (m: ClientMessage) => void
  onDone: () => void
}

const sget = (k: string) => {
  try {
    return sessionStorage.getItem(tabKey(k))
  } catch {
    return null
  }
}
const sset = (k: string, v: string) => {
  try {
    sessionStorage.setItem(tabKey(k), v)
  } catch {
    /* ignore */
  }
}

/** 游戏中保持屏幕常亮 */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const req = () => {
      if (document.visibilityState === 'visible') nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    }
    req()
    document.addEventListener('visibilitychange', req)
    return () => {
      document.removeEventListener('visibilitychange', req)
      lock?.release().catch(() => {})
    }
  }, [])
}

export function GameScreen({ state, status, send, onDone }: Props) {
  const g = state.game as GameView
  const isJudge = state.me.isJudge
  const night = isNight(g.phase) || g.phase === 'dealt'
  useWakeLock()

  // 身份牌展示（每局一次）
  const [revealSeen, setRevealSeen] = useState(() => sget('reveal') === g.id)
  // 公告：只弹出进入页面之后的新公告
  const seenAnn = useRef<number | null>(null)
  const [annQueue, setAnnQueue] = useState<Announcement[]>([])
  useEffect(() => {
    const key = `ann.${g.id}`
    if (seenAnn.current === null) seenAnn.current = Number(sget(key) ?? g.announcements.length)
    if (g.announcements.length > seenAnn.current) {
      const fresh = g.announcements.slice(seenAnn.current)
      setAnnQueue((q) => [...q, ...fresh])
      vibrate([80, 60, 80])
    }
    seenAnn.current = g.announcements.length
    sset(key, String(g.announcements.length))
  }, [g.announcements, g.id])

  // 操作弹窗：出现新操作时自动打开，可关闭后再点开
  const action = isJudge ? null : pendingAction(g)
  const [closedKey, setClosedKey] = useState<string | null>(null)
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    if (action && action.key !== lastKey.current) vibrate(250)
    lastKey.current = action?.key ?? null
  }, [action?.key, action])
  const dialogKinds: ActionKind[] = ['wolf', 'seer', 'witch', 'vote', 'hunter', 'idiot']
  // 先看完全屏公告（如天亮死讯），再弹出操作面板
  const dialogOpen = !!action && dialogKinds.includes(action.kind) && closedKey !== action.key && annQueue.length === 0

  const [peek, setPeek] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [voteView, setVoteView] = useState(false)
  const [confirmAbort, setConfirmAbort] = useState(false)
  const [channel, setChannel] = useState<Channel | null>(null)

  const isSpectator = state.me.isSpectator
  const showReveal = g.phase === 'dealt' && !revealSeen && !isSpectator
  const showResult = g.phase === 'revealed'

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-3 safe-top">
      <Scenery night={night} dim />
      {(g.watching || g.watchLocked) && g.phase !== 'revealed' && <WatchBanner dead={!isSpectator} locked={g.watchLocked} />}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black/40 px-2.5 py-0.5 font-display text-sm text-gold-soft">房间 {state.room.code}</span>
          <ConnBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          {isJudge && state.room.inGame && (
            <button onClick={() => setConfirmAbort(true)} className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-red-300">
              <Square className="size-3" /> 终止
            </button>
          )}
          <button onClick={() => setLogOpen(true)} className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-gold-soft">
            <ScrollText className="size-3.5" /> 记录
          </button>
        </div>
      </header>

      <ChannelBar g={g} isJudge={isJudge} send={send} open={channel} setOpen={setChannel} />

      <SeatTable
        count={g.players.length}
        renderSeat={(seat, side) => <Seat g={g} seat={seat} side={side} peek={peek} isJudge={isJudge} isSpectator={isSpectator} />}
      />

      <div className="mt-3 flex flex-1 flex-col">
        <Stage state={state} send={send} />
      </div>

      {/* 底部操作区 */}
      <div className="sticky bottom-0 z-10 -mx-3 mt-3 px-3 safe-bottom">
        <div className="panel p-3">
          {isJudge ? (
            <JudgeDock g={g} send={send} />
          ) : isSpectator ? (
            <SpectatorDock g={g} onOpenVote={() => setVoteView(true)} onExit={() => send({ type: 'leave' })} peek={peek} setPeek={setPeek} />
          ) : (
            <PlayerDock
              g={g}
              action={action?.kind ?? null}
              send={send}
              onOpenAction={() => setClosedKey(null)}
              onOpenRole={() => setRoleOpen(true)}
              onOpenVote={() => setVoteView(true)}
              peek={peek}
              setPeek={setPeek}
            />
          )}
        </div>
      </div>

      {/* 玩家操作弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setClosedKey(action?.key ?? null)}>
        <DialogContent className="panel flex max-h-[92dvh] max-w-md flex-col gap-3 p-4" onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
          <ActionDialogBody g={g} kind={action?.kind ?? null} send={send} />
        </DialogContent>
      </Dialog>

      {/* 旁观投票 */}
      <Dialog open={voteView && !!g.vote && g.phase === 'voting' && !dialogOpen} onOpenChange={setVoteView}>
        <DialogContent className="panel flex max-h-[90dvh] max-w-md flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">投票情况</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">{g.vote && <VoteBoard g={g} canVote={false} />}</div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAbort} onOpenChange={setConfirmAbort}>
        <AlertDialogContent className="panel max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">终止本局？</AlertDialogTitle>
            <AlertDialogDescription>本局不计胜负，所有人回到房间</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续游戏</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => send({ type: 'abort' })}>
              终止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LogDialog g={g} open={logOpen} onOpenChange={setLogOpen} />
      <MyRoleDialog g={g} isJudge={isJudge} open={roleOpen} onOpenChange={setRoleOpen} />

      {showReveal && (
        <IdentityReveal
          g={g}
          isJudge={isJudge}
          onClose={() => {
            sset('reveal', g.id)
            setRevealSeen(true)
          }}
        />
      )}
      {!showReveal && !showResult && annQueue.length > 0 && <AnnouncementOverlay items={annQueue} g={g} onClose={() => setAnnQueue([])} />}
      {showResult && <ResultOverlay g={g} onNext={onDone} onLog={() => setLogOpen(true)} onOpenChannel={setChannel} />}
    </div>
  )
}

function ActionDialogBody({ g, kind, send }: { g: GameView; kind: ActionKind | null; send: (m: ClientMessage) => void }) {
  const head = (title: string, desc: string, color: string) => (
    <DialogHeader>
      <DialogTitle className={cn('font-display text-2xl', color)}>{title}</DialogTitle>
      <DialogDescription>{desc}</DialogDescription>
    </DialogHeader>
  )
  let body: ReactNode = null
  switch (kind) {
    case 'wolf':
      body = (
        <>
          {head('请确认猎杀对象', '各自选好后点确定，全部确定且一致才算数，可以自刀', 'text-red-400')}
          <WolfPanel g={g} send={send} />
        </>
      )
      break
    case 'seer':
      body = (
        <>
          {head(g.phase === 'seer_result' ? '查验结果' : '选择要查验的玩家', '每晚可以查验一名玩家的阵营', 'text-purple-300')}
          <SeerPanel g={g} send={send} />
        </>
      )
      break
    case 'witch':
      body = (
        <>
          {head('女巫的药剂', g.witch?.bothSameNight ? '可以同时使用两瓶药' : '解药与毒药每晚二选一', 'text-emerald-300')}
          <WitchPanel g={g} send={send} />
        </>
      )
      break
    case 'vote':
      body = (
        <>
          {head(g.vote && g.vote.round > 1 ? 'PK 投票' : '投票放逐', '票数最高的玩家出局，可以弃票', 'text-gold-grad')}
          <VoteBoard g={g} send={send} canVote />
        </>
      )
      break
    case 'hunter':
      body = (
        <>
          {head('猎人开枪', '选择一名玩家与你一同出局', 'text-amber-300')}
          <HunterPanel g={g} send={send} />
        </>
      )
      break
    case 'idiot':
      body = (
        <>
          {head('白痴', '被放逐时可以亮明身份免死一次', 'text-pink-300')}
          <IdiotPanel send={send} />
        </>
      )
      break
  }
  return <div className="-mx-1 min-h-0 space-y-3 overflow-y-auto px-1">{body}</div>
}

/** 一个座位：根据观察者身份显示不同标记 */
function Seat({ g, seat, side, peek, isJudge, isSpectator }: { g: GameView; seat: number; side: 'left' | 'right'; peek: boolean; isJudge: boolean; isSpectator: boolean }) {
  const p = g.players[seat]!
  const night = isNight(g.phase)
  // 观战席默认隐藏身份（公开的身份除外），与出局玩家一样点击「查看身份」切换
  const hideForSpectator = isSpectator && !peek && g.phase !== 'revealed' && seat !== g.idiotRevealed
  const role = hideForSpectator ? undefined : (p.role ?? (peek && g.peekRoles ? g.peekRoles[seat] : undefined))
  const marks: ReactNode[] = []
  let status: ReactNode = null
  let selected = false
  let tone: 'gold' | 'blood' | 'mystic' | 'moss' = 'gold'
  let overlay: ReactNode = null

  // 夜晚：睁眼 / 闭眼
  if (night && p.alive) {
    let open: boolean | null = null
    let color = '#ff3b30'
    const w = g.wolf
    if (w && w.seats.includes(seat) && ['wolf_wake', 'wolf_pick'].includes(g.phase)) open = w.opened.includes(seat)
    if (g.seer && g.seer.seat === seat && ['seer_wake', 'seer_pick', 'seer_result'].includes(g.phase)) {
      open = g.seer.opened
      color = '#8b5cf6'
    }
    if (g.witch && g.witch.seat === seat && ['witch_wake', 'witch_act'].includes(g.phase)) {
      open = g.witch.opened
      color = '#34d399'
    }
    status = (
      <span className="flex h-4 w-6 items-center justify-center rounded-full bg-black/80 ring-1 ring-white/10">
        {open ? <EyeOpen className={cn('h-3 w-5', color === '#ff3b30' && 'animate-eye-glow')} color={color} /> : <EyeClosed className="h-3 w-5 text-white/50" />}
      </span>
    )
  }

  // 狼人选择（狼人与法官可见）
  if (g.wolf && g.phase === 'wolf_pick') {
    const pickers = g.wolf.aliveSeats.filter((s) => g.wolf!.selections[s] === seat)
    for (const s of pickers)
      marks.push(
        <span key={`w${s}`} className="inline-flex items-center gap-0.5 rounded-full bg-blood/80 px-1 text-[9px] font-bold text-white">
          <Paw className="size-2" />
          {s + 1}
        </span>,
      )
    if (g.wolf.confirmed && g.wolf.target === seat) {
      selected = true
      tone = 'blood'
    }
  }
  // 预言家选择
  if (g.seer && ['seer_pick', 'seer_result'].includes(g.phase) && g.seer.selection === seat) {
    selected = true
    tone = 'mystic'
  }
  // 预言家的查验记录：预言家本人、法官、出局观战者可见
  if (g.seer && (g.myRole === 'seer' || g.watching || isJudge)) {
    const h = [...g.seer.history].reverse().find((x) => x.seat === seat)
    if (h) marks.push(<span key="seer">{h.result === 'good' ? '👍' : '👎'}</span>)
  }
  // 投票
  if (g.vote && ['voting', 'vote_result', 'idiot'].includes(g.phase)) {
    for (const s of g.vote.voters) {
      const b = g.vote.ballots[s]
      if (b?.choice === seat) marks.push(<SeatChip key={`v${s}`} seat={s} variant={b.confirmed ? 'solid' : 'dashed'} />)
    }
    if (g.vote.result?.eliminated === seat) {
      selected = true
      tone = 'blood'
    }
  }
  // 已亮明身份的白痴
  if (g.idiotRevealed === seat) marks.push(<span key="idiot" className="rounded-full bg-pink-500/80 px-1.5 text-[9px] font-bold leading-4 text-white">已翻牌 · 无票</span>)
  // 法官与观战者：今晚将死亡
  if ((isJudge || g.watching) && p.pendingDeath) {
    overlay = <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 font-display text-sm text-white">将死</div>
  }

  return (
    <PlayerToken
      seat={seat}
      side={side}
      name={p.user.name}
      online={p.user.online}
      dead={!p.alive}
      role={role}
      me={seat === g.mySeat}
      selected={selected}
      tone={tone}
      status={status}
      marks={marks.length ? marks : undefined}
      overlay={overlay}
    />
  )
}

function PlayerDock({
  g,
  action,
  send,
  onOpenAction,
  onOpenRole,
  onOpenVote,
  peek,
  setPeek,
}: {
  g: GameView
  action: ActionKind | null
  send: (m: ClientMessage) => void
  onOpenAction: () => void
  onOpenRole: () => void
  onOpenVote: () => void
  peek: boolean
  setPeek: (v: boolean) => void
}) {
  const night = isNight(g.phase)
  let main: ReactNode
  const big = (children: ReactNode, onClick: () => void, variant: 'gold' | 'blood' | 'mystic' | 'moss' = 'gold') => (
    <Button variant={variant} size="xl" className="w-full animate-glow" onClick={onClick}>
      {children}
    </Button>
  )
  switch (action) {
    case 'wolfOpen':
    case 'seerOpen':
    case 'witchOpen':
      main = big(
        <>
          <Eye /> 睁眼
        </>,
        () => send({ type: 'openEyes' }),
        action === 'wolfOpen' ? 'blood' : action === 'seerOpen' ? 'mystic' : 'moss',
      )
      break
    case 'wolf':
      main = big(g.wolf?.confirmed ? '查看猎杀结果' : '选择猎杀对象', onOpenAction, 'blood')
      break
    case 'seer':
      main = big(g.phase === 'seer_result' ? '查看查验结果' : '选择查验对象', onOpenAction, 'mystic')
      break
    case 'witch':
      main = big(g.witch?.acted ? '查看用药结果' : '使用药剂', onOpenAction, 'moss')
      break
    case 'vote':
      main = big(g.vote?.ballots[g.mySeat!]?.confirmed ? '查看投票' : '投票', onOpenAction)
      break
    case 'hunter':
      main = big('开枪带人', onOpenAction, 'blood')
      break
    case 'idiot':
      main = big('是否亮明身份', onOpenAction)
      break
    default:
      main = (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-gold-soft/80">
          {night ? <EyeClosed className="h-4 w-6" /> : null}
          {statusText(g)}
        </div>
      )
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={onOpenRole} className="shrink-0 active:scale-95 transition" aria-label="查看我的身份">
        <RoleCard role={g.myRole ?? 'unknown'} size="sm" dead={!g.meAlive} className="w-14" />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        {main}
        {g.phase === 'voting' && action !== 'vote' && (
          <Button variant="stone" size="lg2" className="w-full" onClick={onOpenVote}>
            查看投票情况
          </Button>
        )}
        {!g.meAlive && g.peekRoles && <PeekToggle peek={peek} setPeek={setPeek} />}
      </div>
    </div>
  )
}

function statusText(g: GameView) {
  if (g.watchLocked) return '你已出局，第二晚起可进入观战'
  if (!g.meAlive && g.phase !== 'game_over') return isNight(g.phase) ? '你已出局，正在观战，请勿透露信息' : '你已出局，请保持安静'
  switch (g.phase) {
    case 'dealt':
      return '等待法官宣布天黑'
    case 'day':
      return '白天自由发言，等待法官开始投票'
    case 'hunter':
    case 'idiot':
      return '请稍候…'
    case 'vote_result':
      return g.vote?.result?.resolved ? '等待法官宣布天黑' : '平票，等待法官处理'
    case 'game_over':
      return '游戏结束，等待法官公布结果'
    case 'voting':
      return '你本轮没有投票权'
    default:
      return isNight(g.phase) ? '天黑请闭眼…' : ''
  }
}

export type Channel = 'wolf' | 'ghost'

/**
 * 频道入口：狼人频道（狼人、法官、观战者可见）与观战频道（出局玩家、观战席、法官）。
 * 点击后弹窗展示，带未读数；刀人阶段狼人频道另在选人弹窗/舞台上常驻展示。
 */
function ChannelBar({
  g,
  isJudge,
  send,
  open,
  setOpen,
}: {
  g: GameView
  isJudge: boolean
  send: (m: ClientMessage) => void
  open: Channel | null
  setOpen: (c: Channel | null) => void
}) {
  const wolfMsgs = g.wolf?.chat ?? null
  const ghostMsgs = g.ghostChat
  const [seen, setSeen] = useState(() => ({ wolf: wolfMsgs?.length ?? 0, ghost: ghostMsgs?.length ?? 0 }))

  // 刀人阶段狼人频道已常驻展示，视为已读
  const wolfInline = (isJudge || g.watching) ? ['wolf_wake', 'wolf_pick'].includes(g.phase) : g.myRole === 'werewolf' && g.phase === 'wolf_pick'
  const wolfLen = wolfMsgs?.length ?? 0
  const ghostLen = ghostMsgs?.length ?? 0
  // 正在查看的频道随新消息同步为已读（渲染期间调整状态，避免 effect 里 setState）
  const wolfSeen = open === 'wolf' || wolfInline ? wolfLen : seen.wolf
  const ghostSeen = open === 'ghost' ? ghostLen : seen.ghost
  if (wolfSeen !== seen.wolf || ghostSeen !== seen.ghost) setSeen({ wolf: wolfSeen, ghost: ghostSeen })

  if (!wolfMsgs && !ghostMsgs) return null
  const ended = g.phase === 'revealed'
  const canWolfSpeak = !ended && (isJudge || (g.myRole === 'werewolf' && g.meAlive))
  // 狼人频道只能在夜晚发言
  const canWolfSend = canWolfSpeak && isNight(g.phase)

  const chip = (k: Channel, label: string, unread: number, cls: string) => (
    <button
      type="button"
      onClick={() => setOpen(k)}
      className={cn('relative flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95', cls)}
    >
      {label}
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )

  return (
    <>
      <div className="mb-2 flex gap-2">
        {wolfMsgs && chip('wolf', canWolfSpeak ? '🐺 狼人频道' : '🐺 狼人频道（只读）', wolfLen - wolfSeen, 'border-blood/40 bg-blood/15 text-red-200')}
        {ghostMsgs && chip('ghost', '👁 观战频道', ghostLen - ghostSeen, 'border-mystic/40 bg-mystic/15 text-purple-200')}
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="panel max-w-md">
          <DialogHeader>
            <DialogTitle className={cn('font-display text-xl', open === 'wolf' ? 'text-red-300' : 'text-purple-300')}>
              {open === 'wolf' ? '🐺 狼人频道' : '👁 观战频道'}
            </DialogTitle>
            <DialogDescription>
              {open === 'wolf' ? (canWolfSpeak ? '夜晚狼人与法官可发言，白天只能查看' : '你只能查看，不能发言') : '出局玩家、观战者与法官可见，请勿向场上玩家透露'}
            </DialogDescription>
          </DialogHeader>
          {open === 'wolf' && wolfMsgs && (
            <ChatBox
              messages={wolfMsgs}
              selfId={g.myId}
              onSend={canWolfSend ? (text) => send({ type: 'wolfChat', text }) : undefined}
              notice={ended ? '游戏已结束，仅可查看' : canWolfSpeak && !canWolfSend ? '白天不能发言，天黑后再商量' : undefined}
              placeholder={isJudge ? '以法官身份发言' : '和同伴说点什么'}
              emptyText="狼人频道还没有消息"
              listClassName="h-[50dvh]"
            />
          )}
          {open === 'ghost' && ghostMsgs && (
            <ChatBox
              tone="mystic"
              messages={ghostMsgs}
              selfId={g.myId}
              onSend={ended ? undefined : (text) => send({ type: 'ghostChat', text })}
              notice={ended ? '游戏已结束，仅可查看' : undefined}
              placeholder={isJudge ? '以法官身份发言' : '和其他观战者聊聊'}
              emptyText="观战频道还没有消息"
              listClassName="h-[50dvh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** 观战席底栏：只能看，不能操作 */
function SpectatorDock({
  g,
  onOpenVote,
  onExit,
  peek,
  setPeek,
}: {
  g: GameView
  onOpenVote: () => void
  onExit: () => void
  peek: boolean
  setPeek: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-black/40">
        <Eye className="size-6 text-gold-soft" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm text-gold-soft/85">观战席 · 上帝视角，只能观看</div>
        {g.phase !== 'revealed' && <PeekToggle peek={peek} setPeek={setPeek} />}
        <div className="flex gap-2">
          {g.phase === 'voting' && g.vote && (
            <Button variant="stone" size="lg2" className="flex-1" onClick={onOpenVote}>
              查看投票情况
            </Button>
          )}
          <Button variant="ghost" size="lg2" className="text-muted-foreground" onClick={onExit}>
            <LogOut /> 退出观战
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 出局玩家与观战者查看身份：点击切换显示 / 隐藏 */
function PeekToggle({ peek, setPeek }: { peek: boolean; setPeek: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-xl border font-display transition active:scale-95',
        peek ? 'border-gold bg-gold/25 text-gold-soft' : 'border-gold/40 bg-black/30 text-gold-soft',
      )}
      onClick={() => {
        setPeek(!peek)
        vibrate(20)
      }}
    >
      {peek ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {peek ? '隐藏身份' : '查看身份'}
    </button>
  )
}
