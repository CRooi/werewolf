import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Ban, Check, Send, Undo2 } from 'lucide-react'
import { JUDGE_CHAT_SEAT, SPECTATOR_CHAT_SEAT, type ChatMessage, type ClientMessage, type GameView, type WitchDraft } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Crosshair, Paw, Potion } from '@/components/art/icons'
import { ConfirmDialog, type ConfirmRequest } from '@/components/game/ConfirmDialog'
import { avatarHue, SeatChip } from '@/components/game/PlayerToken'
import { seatName } from './helpers'

type Send = (m: ClientMessage) => void

/** 选人网格 */
export function PickGrid({
  g,
  seats,
  selected,
  onPick,
  tone = 'gold',
  marks,
  tag,
  disabled,
}: {
  g: GameView
  seats: number[]
  selected: number | null
  onPick: (seat: number) => void
  tone?: 'gold' | 'blood' | 'mystic' | 'moss'
  marks?: (seat: number) => ReactNode
  tag?: (seat: number) => ReactNode
  disabled?: boolean
}) {
  const ring = { gold: 'border-gold bg-gold/15', blood: 'border-blood bg-blood/20', mystic: 'border-mystic bg-mystic/20', moss: 'border-moss bg-moss/20' }[tone]
  return (
    <div className="grid grid-cols-3 gap-2">
      {seats.map((s) => {
        const p = g.players[s]!
        const hue = avatarHue(p.user.name)
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-xl border-2 px-1 pb-1.5 pt-2 transition active:scale-95',
              selected === s ? ring : 'border-white/10 bg-black/30',
            )}
          >
            <div className="relative">
              <div
                className="flex size-10 items-center justify-center rounded-full font-display text-lg text-white"
                style={{ background: `radial-gradient(circle at 35% 30%, hsl(${hue} 70% 62%), hsl(${hue} 55% 28%))` }}
              >
                {p.user.name.slice(0, 1)}
              </div>
              <span className="absolute -left-1.5 -top-1 flex size-5 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffe9b0,#c98e33)] font-display text-[11px] font-bold text-[#3a2305]">
                {s + 1}
              </span>
              {tag?.(s)}
            </div>
            <div className="w-full truncate text-center text-xs">{p.user.name}</div>
            <div className="flex min-h-4 flex-wrap justify-center gap-0.5">{marks?.(s)}</div>
          </button>
        )
      })}
    </div>
  )
}

const aliveSeats = (g: GameView) => g.players.filter((p) => p.alive).map((p) => p.seat)

// ---------------- 狼人 ----------------

/**
 * 狼人选人面板：每只狼选好后点「确定」锁定；全部锁定后意见一致则弹窗做最终确认，
 * 不一致或在弹窗里取消，则所有狼人重新选择。
 * mirror 为上帝视角镜像：只读展示狼人看到的界面；canChat 控制镜像模式下能否在狼人频道发言（法官夜间可发言）。
 */
export function WolfPanel({ g, send, mirror, canChat }: { g: GameView; send?: Send; mirror?: boolean; canChat?: boolean }) {
  const w = g.wolf!
  const me = mirror ? null : g.mySeat
  const mine = me !== null ? (w.selections[me] ?? null) : null
  const myLocked = me !== null && w.locked.includes(me)
  const pending = w.pending
  const choices = w.aliveSeats.map((s) => w.selections[s] ?? null)
  const unanimous = choices.length > 0 && choices[0] !== null && choices.every((c) => c === choices[0])
  const lockedCount = w.aliveSeats.filter((s) => w.locked.includes(s)).length
  const pickers = (target: number | 'none') => w.aliveSeats.filter((s) => w.selections[s] === target)
  const frozen = mirror || myLocked || pending !== null
  const pick = (c: number | 'none') => !frozen && send?.({ type: 'wolfSelect', choice: mine === c ? null : c })
  // 镜像时高亮意见统一的目标
  const highlight = mirror ? (unanimous && typeof choices[0] === 'number' ? choices[0] : null) : typeof mine === 'number' ? mine : null
  const noneActive = mirror ? unanimous && choices[0] === 'none' : mine === 'none'
  const pendingText = pending === 'none' ? '今晚不进行猎杀' : pending !== null ? `猎杀 ${seatName(g, pending)}` : ''
  const finalAsk: ConfirmRequest | null =
    !mirror && pending !== null && !w.confirmed
      ? {
          title: pending === 'none' ? '确定今晚不猎杀吗？' : `确定要刀 ${seatName(g, pending)} 吗？`,
          description: '狼人意见一致。确定后提交给法官；取消则所有狼人重新选择。',
          tone: 'blood',
          onConfirm: () => send?.({ type: 'wolfFinal' }),
        }
      : null

  return (
    <div className="space-y-3">
      {w.confirmed ? (
        <div className="rounded-xl border border-blood/50 bg-blood/15 p-3 text-center font-display text-lg">
          {w.target === 'none' ? '今晚不进行猎杀' : `今晚猎杀：${seatName(g, w.target as number)}`}
          <div className="mt-1 font-sans text-xs text-muted-foreground">等待法官让狼人闭眼</div>
        </div>
      ) : (
        <>
          {pending !== null ? (
            <div className="rounded-xl border border-blood/50 bg-blood/15 p-3 text-center">
              <div className="font-display text-lg">意见一致：{pendingText}</div>
              <div className="mt-1 text-xs text-muted-foreground">等待狼人最终确认，取消则全部重新选择</div>
            </div>
          ) : (
            w.note && <div className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-center text-xs text-amber-200">第 {w.round} 轮选择 · {w.note}</div>
          )}
          <PickGrid
            g={g}
            seats={aliveSeats(g)}
            selected={highlight}
            tone="blood"
            disabled={frozen}
            onPick={pick}
            tag={(s) => w.seats.includes(s) && <span className="absolute -bottom-1 -right-2 rounded bg-blood px-1 text-[9px] text-white">狼</span>}
            marks={(s) => pickers(s).map((p) => <PawChip key={p} seat={p} locked={w.locked.includes(p)} />)}
          />
          <button
            type="button"
            disabled={frozen}
            onClick={() => pick('none')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-sm transition',
              noneActive ? 'border-blood bg-blood/20' : 'border-white/10 bg-black/30',
            )}
          >
            <span className="flex items-center gap-2">
              <Ban className="size-4" /> 今晚不进行猎杀
            </span>
            <span className="flex gap-0.5">{pickers('none').map((p) => <PawChip key={p} seat={p} locked={w.locked.includes(p)} />)}</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-muted-foreground">
              <span className={cn(unanimous ? 'text-emerald-300' : 'text-amber-300')}>{unanimous ? '意见已统一' : '意见未统一'}</span>
              <span className="ml-1">
                · 已确定 {lockedCount}/{w.aliveSeats.length}
              </span>
            </div>
            {myLocked && pending === null ? (
              <Button variant="stone" size="lg2" onClick={() => send?.({ type: 'wolfCancel' })}>
                <Undo2 className="size-4" /> 取消确定
              </Button>
            ) : (
              <Button variant="blood" size="lg2" disabled={frozen || mine === null} onClick={() => send?.({ type: 'wolfConfirm' })}>
                <Crosshair className="size-4" /> 确定
              </Button>
            )}
          </div>
          {!mirror && (
            <div className="text-center text-[11px] text-muted-foreground">
              {myLocked && pending === null ? '已确定，等待同伴…所有狼人确定后才会揭晓结果' : '所有狼人都确定后，意见一致才会提交，否则重新选择'}
            </div>
          )}
        </>
      )}
      <WolfChat g={g} send={send} readOnly={mirror && !canChat} />
      <ConfirmDialog request={finalAsk} onClose={() => {}} onCancel={() => send?.({ type: 'wolfCancel' })} />
    </div>
  )
}

function PawChip({ seat, locked }: { seat: number; locked?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1 text-[10px] font-bold text-white',
        locked ? 'bg-blood ring-1 ring-red-200/80' : 'border border-dashed border-blood/80 bg-blood/30',
      )}
    >
      <Paw className="size-2.5" />
      {seat + 1}
      {locked && <Check className="size-2.5" />}
    </span>
  )
}

/** 发言者标签：法官 / 观战席 / 座位号 */
function speakerLabel(m: ChatMessage) {
  if (m.seat === JUDGE_CHAT_SEAT) return '⚖️ 法官'
  if (m.seat === SPECTATOR_CHAT_SEAT) return `👁 ${m.name}`
  return `${m.seat + 1}号 ${m.name}`
}

/** 通用频道聊天框 */
export function ChatBox({
  title,
  messages,
  selfId,
  onSend,
  tone = 'blood',
  placeholder = '说点什么',
  emptyText = '还没有人发言',
  listClassName = 'max-h-36 min-h-16',
  notice,
}: {
  title?: string
  messages: ChatMessage[]
  /** 自己的用户 id，用于把自己的发言靠右显示 */
  selfId: string
  onSend?: (text: string) => void
  tone?: 'blood' | 'mystic'
  placeholder?: string
  emptyText?: string
  listClassName?: string
  /** 不能发言时在输入框位置显示的提示 */
  notice?: string
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])
  const submit = () => {
    if (!text.trim() || !onSend) return
    onSend(text)
    setText('')
  }
  const t =
    tone === 'blood'
      ? { border: 'border-blood/30', line: 'border-blood/20', title: 'text-red-300', mine: 'bg-blood/70 text-white', label: 'text-red-300' }
      : { border: 'border-mystic/30', line: 'border-mystic/20', title: 'text-purple-300', mine: 'bg-mystic/70 text-white', label: 'text-purple-300' }
  return (
    <div className={cn('rounded-xl border bg-black/40', t.border)}>
      {title && <div className={cn('border-b px-3 py-1.5 font-display text-xs', t.line, t.title)}>{title}</div>}
      <div ref={listRef} className={cn('space-y-1.5 overflow-y-auto p-2', listClassName)}>
        {messages.length === 0 && <div className="py-3 text-center text-xs text-muted-foreground">{emptyText}</div>}
        {messages.map((m, i) => {
          const fromJudge = m.seat === JUDGE_CHAT_SEAT
          const mine = m.uid === selfId
          const newSection = m.label && m.label !== messages[i - 1]?.label
          return (
            <Fragment key={i}>
            {newSection && <div className="divider-ornament py-0.5 text-[10px]">{m.label}</div>}
            <div className={cn('flex', mine && 'justify-end')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-2.5 py-1 text-sm',
                  mine ? (fromJudge ? 'bg-gold/80 text-[#2a1a05]' : t.mine) : fromJudge ? 'border border-gold/40 bg-gold/15' : 'bg-white/10',
                )}
              >
                {!mine && <span className={cn('mr-1 text-[10px]', fromJudge ? 'text-gold' : t.label)}>{speakerLabel(m)}</span>}
                {m.text}
              </div>
            </div>
            </Fragment>
          )
        })}
      </div>
      {!onSend && notice && <div className={cn('border-t px-3 py-2.5 text-center text-xs text-muted-foreground', t.line)}>{notice}</div>}
      {onSend && (
        <div className={cn('flex gap-2 border-t p-2', t.line)}>
          <Input
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
            placeholder={placeholder}
            className="h-9 bg-black/30"
          />
          <Button size="icon-lg" variant={tone} onClick={submit} aria-label="发送">
            <Send />
          </Button>
        </div>
      )}
    </div>
  )
}

/** 狼人频道 */
export function WolfChat({ g, send, readOnly }: { g: GameView; send?: Send; readOnly?: boolean }) {
  return (
    <ChatBox
      title="🐺 狼人频道"
      messages={g.wolf?.chat ?? []}
      selfId={g.myId}
      onSend={readOnly || !send ? undefined : (text) => send({ type: 'wolfChat', text })}
      placeholder={g.mySeat === null ? '以法官身份发言' : '和同伴说点什么'}
      emptyText="悄悄商量一下吧…"
    />
  )
}

// ---------------- 预言家 ----------------

export function SeerPanel({ g, send, mirror }: { g: GameView; send?: Send; mirror?: boolean }) {
  const s = g.seer!
  const [ask, setAsk] = useState<ConfirmRequest | null>(null)
  const history = Object.fromEntries(s.history.map((h) => [h.seat, h.result]))
  if (g.phase === 'seer_result' && s.result && s.selection !== null) {
    const good = s.result === 'good'
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="text-sm text-muted-foreground">{seatName(g, s.selection)} 的身份是</div>
        <div className={cn('animate-flip-in text-7xl', good ? 'drop-shadow-[0_0_20px_rgba(63,174,122,0.8)]' : 'drop-shadow-[0_0_20px_rgba(210,60,60,0.8)]')}>
          {good ? '👍' : '👎'}
        </div>
        <div className={cn('font-display text-3xl', good ? 'text-emerald-300' : 'text-red-400')}>{good ? '好人' : '坏人'}</div>
        <div className="text-xs text-muted-foreground">等待法官让预言家闭眼</div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <PickGrid
        g={g}
        seats={aliveSeats(g).filter((x) => x !== s.seat)}
        selected={s.selection}
        tone="mystic"
        disabled={mirror || s.confirmed}
        onPick={(seat) => send?.({ type: 'seerSelect', seat })}
        marks={(seat) => history[seat] && <span className="text-xs">{history[seat] === 'good' ? '👍' : '👎'}</span>}
      />
      {s.confirmed ? (
        <div className="text-center text-sm text-muted-foreground">已选择 {seatName(g, s.selection!)}，等待法官验明身份…</div>
      ) : (
        <Button
          variant="mystic"
          size="xl"
          className="w-full"
          disabled={mirror || s.selection === null}
          onClick={() =>
            setAsk({ title: `确定查验 ${seatName(g, s.selection!)} 吗？`, description: '确定后不能更换查验对象。', tone: 'mystic', onConfirm: () => send?.({ type: 'seerConfirm' }) })
          }
        >
          <Check /> {mirror ? (s.selection === null ? '预言家正在选择…' : `预言家正在看 ${seatName(g, s.selection)}`) : '确定查验'}
        </Button>
      )}
      <ConfirmDialog request={ask} onClose={() => setAsk(null)} />
    </div>
  )
}

// ---------------- 女巫 ----------------

export function WitchPanel({ g, send, mirror }: { g: GameView; send?: Send; mirror?: boolean }) {
  const w = g.witch!
  const [local, setLocal] = useState<WitchDraft>({ save: false, poison: false, target: null })
  const [ask, setAsk] = useState<ConfirmRequest | null>(null)
  // 镜像时展示女巫的实时选择；女巫本人改动时同步到服务端
  const draft = mirror ? w.draft : local
  const update = (d: WitchDraft) => {
    if (mirror) return
    setLocal(d)
    send?.({ type: 'witchDraft', ...d })
  }

  if (w.acted) {
    const who = mirror ? '女巫' : '你'
    return (
      <div className="py-6 text-center">
        <div className="font-display text-xl text-emerald-200">
          {w.saved && w.poisoned !== null ? `${who}使用了解药和毒药` : w.saved ? `${who}使用了解药` : w.poisoned !== null ? `${who}毒杀了 ${seatName(g, w.poisoned)}` : `今晚${who}没有用药`}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">等待法官让女巫闭眼</div>
      </div>
    )
  }

  const victim = w.victim
  // 镜像时只展示女巫本人能看到的死讯
  const showVictim = w.canSeeVictim
  const selfBlocked = victim === w.seat && !w.selfSave
  const canSave = w.antidote && showVictim && victim !== null && !selfBlocked
  const act = (save: boolean, poison: number | null) => send?.({ type: 'witchAct', save, poison })
  // 解药：弹窗确认后即生效；若本局允许同晚用两瓶药且毒药还在，则记下选择继续决定毒药
  const toggleSave = () => {
    if (!canSave) return
    if (draft.save) return update({ ...draft, save: false })
    const keepGoing = w.bothSameNight && w.poison
    setAsk({
      title: '确定要使用解药吗？',
      description: `救下 ${seatName(g, victim!)}。${keepGoing ? '之后还可以决定是否使用毒药。' : '确定后今晚的行动结束。'}`,
      tone: 'moss',
      onConfirm: () => (keepGoing ? update({ ...draft, save: true }) : act(true, null)),
    })
  }
  // 毒药：先确认要使用，再选人，选好后点确定还有一次确认
  const togglePoison = () => {
    if (!w.poison) return
    if (draft.poison) return update({ ...draft, poison: false, target: null })
    setAsk({
      title: '确定要使用毒药吗？',
      description: '确定后选择要毒杀的玩家。',
      tone: 'mystic',
      onConfirm: () => update({ save: w.bothSameNight ? draft.save : false, poison: true, target: null }),
    })
  }
  const submit = () => {
    const target = draft.poison ? draft.target : null
    if (target === null) return act(draft.save, null)
    setAsk({
      title: `确定要毒杀 ${seatName(g, target)} 吗？`,
      description: draft.save ? `同时使用解药救下 ${seatName(g, victim!)}。` : '毒药只有一瓶，确定后无法撤回。',
      tone: 'mystic',
      onConfirm: () => act(draft.save, target),
    })
  }
  const ready = draft.save || (draft.poison && draft.target !== null)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-moss/40 bg-black/40 p-3 text-center">
        <div className="text-[11px] tracking-widest text-emerald-200/70">今晚的死亡情况</div>
        <div className="mt-1 font-display text-xl">
          {!showVictim ? <span className="text-muted-foreground">解药已用完，无法得知</span> : victim === null ? '平安夜，无人被猎杀' : <span className="text-red-300">{seatName(g, victim)} 被猎杀</span>}
        </div>
        {selfBlocked && w.antidote && showVictim && <div className="mt-1 text-xs text-amber-300">女巫不能自救</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={mirror || !canSave}
          onClick={toggleSave}
          className={cn('flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition', !canSave && 'opacity-35', draft.save ? 'border-moss bg-moss/25' : 'border-white/10 bg-black/30')}
        >
          <Potion color="#34d399" className="size-10" />
          <span className="font-display">使用解药</span>
          <span className="text-[10px] text-muted-foreground">{w.antidote ? '剩余 1 瓶' : '已用完'}</span>
        </button>
        <button
          type="button"
          disabled={mirror || !w.poison}
          onClick={togglePoison}
          className={cn('flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition', !w.poison && 'opacity-35', draft.poison ? 'border-mystic bg-mystic/25' : 'border-white/10 bg-black/30')}
        >
          <Potion color="#a855f7" className="size-10" />
          <span className="font-display">使用毒药</span>
          <span className="text-[10px] text-muted-foreground">{w.poison ? '剩余 1 瓶' : '已用完'}</span>
        </button>
      </div>
      <div className="text-center text-[11px] text-muted-foreground">{w.bothSameNight ? '本局解药与毒药可同晚使用' : '本局每晚只能使用一瓶药'}</div>
      {draft.poison && (
        <div className="space-y-1.5">
          <div className="text-xs text-purple-200">选择要毒杀的玩家：</div>
          <PickGrid
            g={g}
            seats={aliveSeats(g)}
            selected={draft.target}
            tone="mystic"
            disabled={mirror}
            onPick={(s) => update({ ...draft, target: draft.target === s ? null : s })}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="stone" size="lg2" className="flex-1" disabled={mirror} onClick={() => act(false, null)}>
          不使用
        </Button>
        <Button
          variant="moss"
          size="lg2"
          className="flex-[2]"
          disabled={mirror || !ready}
          onClick={submit}
        >
          <Check /> 确定
        </Button>
      </div>
      <ConfirmDialog request={ask} onClose={() => setAsk(null)} />
    </div>
  )
}

// ---------------- 投票 ----------------

export function VoteBoard({ g, send, canVote }: { g: GameView; send?: Send; canVote: boolean }) {
  const v = g.vote!
  const me = g.mySeat
  const my = me !== null ? v.ballots[me] : undefined
  const locked = !canVote || !!my?.confirmed
  // 已亮明身份的白痴不能被投票
  const candidates = (v.candidates ?? aliveSeats(g)).filter((s) => s !== g.idiotRevealed)
  const votersFor = (c: number | 'abstain') => v.voters.filter((s) => v.ballots[s]?.choice === c)
  const chips = (c: number | 'abstain') => votersFor(c).map((s) => <SeatChip key={s} seat={s} variant={v.ballots[s]!.confirmed ? 'solid' : 'dashed'} />)
  const pick = (c: number | 'abstain') => !locked && send?.({ type: 'voteSelect', choice: my?.choice === c ? null : c })
  const confirmed = v.voters.filter((s) => v.ballots[s]?.confirmed).length
  // 还没确认投票的人（只选了没确认也算）
  const pending = v.voters.filter((s) => !v.ballots[s]?.confirmed)
  const [ask, setAsk] = useState<ConfirmRequest | null>(null)
  const confirmVote = () => {
    const c = my?.choice
    if (c === null || c === undefined) return
    setAsk({
      title: c === 'abstain' ? '确定弃票吗？' : `确定投给 ${seatName(g, c)} 吗？`,
      description: '投票确认后不能更改。',
      onConfirm: () => send?.({ type: 'voteConfirm' }),
    })
  }

  return (
    <div className="space-y-3">
      {v.round > 1 && <div className="rounded-lg bg-gold/15 py-1 text-center text-xs text-gold-soft">PK 投票：只能投给平票玩家，PK 玩家本人不投票</div>}
      <PickGrid g={g} seats={candidates} selected={typeof my?.choice === 'number' ? my.choice : null} onPick={pick} disabled={locked} marks={chips} />
      <button
        type="button"
        disabled={locked}
        onClick={() => pick('abstain')}
        className={cn('flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-sm', my?.choice === 'abstain' ? 'border-gold bg-gold/15' : 'border-white/10 bg-black/30')}
      >
        <span className="flex items-center gap-2">
          <Ban className="size-4" /> 弃票
        </span>
        <span className="flex gap-0.5">{chips('abstain')}</span>
      </button>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <SeatChip seat={0} /> 已确认 <SeatChip seat={0} variant="dashed" /> 未确认
        </span>
        <span>
          已确认 {confirmed}/{v.voters.length}
        </span>
      </div>
      {pending.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <div className="mb-1.5 text-[11px] text-muted-foreground">还没投票（{pending.length} 人）</div>
          <div className="flex flex-wrap gap-1.5">
            {pending.map((s) => (
              <span key={s} className={cn('rounded-full px-2 py-0.5 text-xs', s === me ? 'bg-gold/25 text-gold-soft' : 'bg-white/10')}>
                {seatName(g, s)}
                {s === me && '（我）'}
              </span>
            ))}
          </div>
        </div>
      )}
      {canVote &&
        (my?.confirmed ? (
          <div className="text-center text-sm text-muted-foreground">
            已{my.choice === 'abstain' ? '弃票' : `投给 ${seatName(g, my.choice as number)}`}，等待其他玩家…
          </div>
        ) : (
          <Button variant="gold" size="xl" className="w-full" disabled={!my || my.choice === null} onClick={confirmVote}>
            <Check /> 确认投票
          </Button>
        ))}
      <ConfirmDialog request={ask} onClose={() => setAsk(null)} />
    </div>
  )
}

// ---------------- 猎人 ----------------

export function HunterPanel({ g, send, mirror }: { g: GameView; send?: Send; mirror?: boolean }) {
  const h = g.hunter!
  const [local, setLocal] = useState<number | null>(null)
  const target = mirror ? h.draft : local
  const pick = (s: number) => {
    if (mirror) return
    const t = local === s ? null : s
    setLocal(t)
    send?.({ type: 'hunterDraft', target: t })
  }
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-amber-200">{mirror ? `${h.seat + 1}号 是猎人，正在决定是否开枪` : '你倒下了，但你的猎枪还有一发子弹'}</p>
      <PickGrid g={g} seats={aliveSeats(g).filter((s) => s !== h.seat)} selected={target} tone="blood" disabled={mirror} onPick={pick} />
      <div className="flex gap-2">
        <Button variant="stone" size="lg2" className="flex-1" disabled={mirror} onClick={() => send?.({ type: 'hunterShoot', target: null })}>
          不带人
        </Button>
        <Button variant="blood" size="lg2" className="flex-[2]" disabled={mirror || target === null} onClick={() => send?.({ type: 'hunterShoot', target })}>
          <Crosshair className="size-4" /> 开枪带走
        </Button>
      </div>
    </div>
  )
}

// ---------------- 白痴 ----------------

export function IdiotPanel({ send, mirror, seat }: { send?: Send; mirror?: boolean; seat?: number }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-pink-200">
        {mirror ? `${(seat ?? 0) + 1}号 是白痴，正在决定是否亮明身份` : '你被投票放逐了。作为白痴，你可以亮明身份免于出局，但此后不能投票，也不能被投票。'}
      </p>
      <Button variant="gold" size="xl" className="w-full" disabled={mirror} onClick={() => send?.({ type: 'idiotDecide', reveal: true })}>
        亮明身份，免于出局
      </Button>
      <Button variant="stone" size="lg2" className="w-full" disabled={mirror} onClick={() => send?.({ type: 'idiotDecide', reveal: false })}>
        不亮身份，直接出局
      </Button>
    </div>
  )
}
