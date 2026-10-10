import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Ban, Check, Send } from 'lucide-react'
import { JUDGE_CHAT_SEAT, SPECTATOR_CHAT_SEAT, type ChatMessage, type ClientMessage, type GameView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Crosshair, Paw, Potion } from '@/components/art/icons'
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

export function WolfPanel({ g, send }: { g: GameView; send: Send }) {
  const w = g.wolf!
  const me = g.mySeat!
  const mine = w.selections[me] ?? null
  const choices = w.aliveSeats.map((s) => w.selections[s] ?? null)
  const unanimous = choices.length > 0 && choices[0] !== null && choices.every((c) => c === choices[0])
  const pickers = (target: number | 'none') => w.aliveSeats.filter((s) => w.selections[s] === target)
  const pick = (c: number | 'none') => !w.confirmed && send({ type: 'wolfSelect', choice: mine === c ? null : c })

  return (
    <div className="space-y-3">
      {w.confirmed ? (
        <div className="rounded-xl border border-blood/50 bg-blood/15 p-3 text-center font-display text-lg">
          {w.target === 'none' ? '今晚不进行猎杀' : `今晚猎杀：${seatName(g, w.target as number)}`}
          <div className="mt-1 font-sans text-xs text-muted-foreground">等待法官让狼人闭眼</div>
        </div>
      ) : (
        <>
          <PickGrid
            g={g}
            seats={aliveSeats(g)}
            selected={typeof mine === 'number' ? mine : null}
            tone="blood"
            onPick={pick}
            tag={(s) => w.seats.includes(s) && <span className="absolute -bottom-1 -right-2 rounded bg-blood px-1 text-[9px] text-white">狼</span>}
            marks={(s) => pickers(s).map((p) => <PawChip key={p} seat={p} />)}
          />
          <button
            type="button"
            onClick={() => pick('none')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-sm transition',
              mine === 'none' ? 'border-blood bg-blood/20' : 'border-white/10 bg-black/30',
            )}
          >
            <span className="flex items-center gap-2">
              <Ban className="size-4" /> 今晚不进行猎杀
            </span>
            <span className="flex gap-0.5">{pickers('none').map((p) => <PawChip key={p} seat={p} />)}</span>
          </button>
          <div className="flex items-center gap-2">
            <div className={cn('flex-1 text-xs', unanimous ? 'text-emerald-300' : 'text-amber-300')}>
              {unanimous ? '意见已统一' : '请统一意见。'}
              <span className="ml-1 text-muted-foreground">
                ({choices.filter((c) => c !== null).length}/{w.aliveSeats.length} 已选择)
              </span>
            </div>
            <Button variant="blood" size="lg2" disabled={!unanimous} onClick={() => send({ type: 'wolfConfirm' })}>
              <Crosshair className="size-4" /> 确定
            </Button>
          </div>
        </>
      )}
      <WolfChat g={g} send={send} />
    </div>
  )
}

function PawChip({ seat }: { seat: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-blood/80 px-1 text-[10px] font-bold text-white">
      <Paw className="size-2.5" />
      {seat + 1}
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

export function SeerPanel({ g, send }: { g: GameView; send: Send }) {
  const s = g.seer!
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
        seats={aliveSeats(g).filter((x) => x !== g.mySeat)}
        selected={s.selection}
        tone="mystic"
        disabled={s.confirmed}
        onPick={(seat) => send({ type: 'seerSelect', seat })}
        marks={(seat) => history[seat] && <span className="text-xs">{history[seat] === 'good' ? '👍' : '👎'}</span>}
      />
      {s.confirmed ? (
        <div className="text-center text-sm text-muted-foreground">已选择 {seatName(g, s.selection!)}，等待法官验明身份…</div>
      ) : (
        <Button variant="mystic" size="xl" className="w-full" disabled={s.selection === null} onClick={() => send({ type: 'seerConfirm' })}>
          <Check /> 确定查验
        </Button>
      )}
    </div>
  )
}

// ---------------- 女巫 ----------------

export function WitchPanel({ g, send }: { g: GameView; send: Send }) {
  const w = g.witch!
  const [save, setSave] = useState(false)
  const [poisonMode, setPoisonMode] = useState(false)
  const [target, setTarget] = useState<number | null>(null)

  if (w.acted) {
    return (
      <div className="py-6 text-center">
        <div className="font-display text-xl text-emerald-200">
          {w.saved && w.poisoned !== null ? '你使用了解药和毒药' : w.saved ? '你使用了解药' : w.poisoned !== null ? `你毒杀了 ${seatName(g, w.poisoned)}` : '今晚你没有用药'}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">等待法官让女巫闭眼</div>
      </div>
    )
  }

  const victim = w.victim
  const selfBlocked = victim === g.mySeat && !w.selfSave
  const canSave = w.antidote && victim !== null && !selfBlocked
  const toggleSave = () => {
    if (!canSave) return
    setSave(!save)
    if (!save && !w.bothSameNight) {
      setPoisonMode(false)
      setTarget(null)
    }
  }
  const togglePoison = () => {
    if (!w.poison) return
    setPoisonMode(!poisonMode)
    if (poisonMode) setTarget(null)
    if (!poisonMode && !w.bothSameNight) setSave(false)
  }
  const ready = save || (poisonMode && target !== null)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-moss/40 bg-black/40 p-3 text-center">
        <div className="text-[11px] tracking-widest text-emerald-200/70">今晚的死亡情况</div>
        <div className="mt-1 font-display text-xl">
          {!w.canSeeVictim ? <span className="text-muted-foreground">解药已用完，无法得知</span> : victim === null ? '平安夜，无人被猎杀' : <span className="text-red-300">{seatName(g, victim)} 被猎杀</span>}
        </div>
        {selfBlocked && w.antidote && <div className="mt-1 text-xs text-amber-300">女巫不能自救</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={toggleSave}
          className={cn('flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition disabled:opacity-35', save ? 'border-moss bg-moss/25' : 'border-white/10 bg-black/30')}
        >
          <Potion color="#34d399" className="size-10" />
          <span className="font-display">使用解药</span>
          <span className="text-[10px] text-muted-foreground">{w.antidote ? '剩余 1 瓶' : '已用完'}</span>
        </button>
        <button
          type="button"
          disabled={!w.poison}
          onClick={togglePoison}
          className={cn('flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition disabled:opacity-35', poisonMode ? 'border-mystic bg-mystic/25' : 'border-white/10 bg-black/30')}
        >
          <Potion color="#a855f7" className="size-10" />
          <span className="font-display">使用毒药</span>
          <span className="text-[10px] text-muted-foreground">{w.poison ? '剩余 1 瓶' : '已用完'}</span>
        </button>
      </div>
      <div className="text-center text-[11px] text-muted-foreground">{w.bothSameNight ? '本局解药与毒药可同晚使用' : '本局每晚只能使用一瓶药'}</div>
      {poisonMode && (
        <div className="space-y-1.5">
          <div className="text-xs text-purple-200">选择要毒杀的玩家：</div>
          <PickGrid g={g} seats={aliveSeats(g)} selected={target} tone="mystic" onPick={(s) => setTarget(target === s ? null : s)} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="stone" size="lg2" className="flex-1" onClick={() => send({ type: 'witchAct', save: false, poison: null })}>
          不使用
        </Button>
        <Button
          variant="moss"
          size="lg2"
          className="flex-[2]"
          disabled={!ready}
          onClick={() => send({ type: 'witchAct', save, poison: poisonMode ? target : null })}
        >
          <Check /> 确定
        </Button>
      </div>
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
      {canVote &&
        (my?.confirmed ? (
          <div className="text-center text-sm text-muted-foreground">已投票，等待其他玩家…</div>
        ) : (
          <Button variant="gold" size="xl" className="w-full" disabled={!my || my.choice === null} onClick={() => send?.({ type: 'voteConfirm' })}>
            <Check /> 确认投票
          </Button>
        ))}
    </div>
  )
}

// ---------------- 猎人 ----------------

export function HunterPanel({ g, send }: { g: GameView; send: Send }) {
  const [target, setTarget] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-amber-200">你倒下了，但你的猎枪还有一发子弹</p>
      <PickGrid g={g} seats={aliveSeats(g).filter((s) => s !== g.mySeat)} selected={target} tone="blood" onPick={(s) => setTarget(target === s ? null : s)} />
      <div className="flex gap-2">
        <Button variant="stone" size="lg2" className="flex-1" onClick={() => send({ type: 'hunterShoot', target: null })}>
          不带人
        </Button>
        <Button variant="blood" size="lg2" className="flex-[2]" disabled={target === null} onClick={() => send({ type: 'hunterShoot', target })}>
          <Crosshair className="size-4" /> 开枪带走
        </Button>
      </div>
    </div>
  )
}

// ---------------- 白痴 ----------------

export function IdiotPanel({ send }: { send: Send }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-pink-200">你被投票放逐了。作为白痴，你可以亮明身份免于出局，但此后不能投票，也不能被投票。</p>
      <Button variant="gold" size="xl" className="w-full" onClick={() => send({ type: 'idiotDecide', reveal: true })}>
        亮明身份，免于出局
      </Button>
      <Button variant="stone" size="lg2" className="w-full" onClick={() => send({ type: 'idiotDecide', reveal: false })}>
        不亮身份，直接出局
      </Button>
    </div>
  )
}
