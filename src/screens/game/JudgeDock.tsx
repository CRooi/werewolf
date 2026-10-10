import { useState, type ReactNode } from 'react'
import { MessageSquare, Moon, Sun, Vote } from 'lucide-react'
import type { ClientMessage, GameView, JudgeStep } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WolfChat } from './ActionPanels'
import { seatName } from './helpers'

type Send = (m: ClientMessage) => void

function Info({ children, tone }: { children: ReactNode; tone?: 'ok' | 'wait' | 'bad' }) {
  return (
    <div className={cn('text-center text-sm', tone === 'ok' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-gold-soft/85')}>{children}</div>
  )
}

interface StepButtonProps {
  s: JudgeStep
  children: ReactNode
  disabled?: boolean
  variant?: 'gold' | 'blood' | 'mystic' | 'moss' | 'stone'
  onStep: (s: JudgeStep) => void
}

function StepButton({ s, children, disabled, variant = 'gold', onStep }: StepButtonProps) {
  return (
    <Button variant={variant} size="xl" className={cn('w-full', !disabled && 'animate-glow')} disabled={disabled} onClick={() => onStep(s)}>
      {children}
    </Button>
  )
}

/** 法官控制台：根据阶段显示下一步按钮与进度 */
export function JudgeDock({ g, send }: { g: GameView; send: Send }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [choosingTie, setChoosingTie] = useState(false)
  const step = (s: JudgeStep) => send({ type: 'judge', step: s })

  const w = g.wolf
  const seer = g.seer
  const witch = g.witch
  let body: ReactNode = null

  switch (g.phase) {
    case 'dealt':
      body = (
        <>
          <Info>身份已发放，所有人的身份已显示在座位上</Info>
          <StepButton onStep={step} s="nightStart">
            <Moon /> 天黑请闭眼
          </StepButton>
        </>
      )
      break
    case 'night_start':
      body = <StepButton onStep={step} s="wolfWake" variant="blood">狼人请睁眼</StepButton>
      break
    case 'wolf_wake': {
      const opened = w!.aliveSeats.filter((s) => w!.opened.includes(s)).length
      const all = opened === w!.aliveSeats.length
      body = (
        <>
          <Info tone={all ? 'ok' : 'wait'}>
            有 {opened}/{w!.aliveSeats.length} 个狼人已睁眼
          </Info>
          <StepButton onStep={step} s="wolfPick" variant="blood" disabled={!all}>
            请确认猎杀对象
          </StepButton>
        </>
      )
      break
    }
    case 'wolf_pick': {
      const chosen = w!.aliveSeats.filter((s) => (w!.selections[s] ?? null) !== null).length
      body = (
        <>
          {w!.confirmed ? (
            <Info tone="bad">{w!.target === 'none' ? '狼人选择今晚不猎杀' : `狼人猎杀了 ${seatName(g, w!.target as number)}`}</Info>
          ) : (
            <Info>
              狼人正在商量… 已选择 {chosen}/{w!.aliveSeats.length}
              {w!.selections && Object.values(w!.selections).includes('none') && <span className="ml-1 text-xs">(有人选择不猎杀)</span>}
            </Info>
          )}
          <StepButton onStep={step} s="wolfClose" disabled={!w!.confirmed}>
            狼人请闭眼
          </StepButton>
        </>
      )
      break
    }
    case 'night_menu': {
      const needSeer = g.hasSeer && !g.seerDone
      const needWitch = g.hasWitch && !g.witchDone
      body =
        needSeer || needWitch ? (
          <div className="flex gap-2">
            {needSeer && (
              <Button variant="mystic" size="xl" className="flex-1 animate-glow px-2" onClick={() => step('seerWake')}>
                预言家请睁眼
              </Button>
            )}
            {needWitch && (
              <Button variant="moss" size="xl" className="flex-1 animate-glow px-2" onClick={() => step('witchWake')}>
                女巫请睁眼
              </Button>
            )}
          </div>
        ) : (
          <StepButton onStep={step} s="dawn">
            <Sun /> 天亮了
          </StepButton>
        )
      break
    }
    case 'seer_wake':
      body = !seer!.alive ? (
        <>
          <Info>预言家已出局（仍需走流程，避免泄露信息）</Info>
          <StepButton onStep={step} s="seerClose" variant="stone">
            预言家请闭眼
          </StepButton>
        </>
      ) : (
        <>
          <Info tone={seer!.opened ? 'ok' : 'wait'}>{seer!.opened ? '预言家已睁眼' : '等待预言家睁眼… 0/1'}</Info>
          <StepButton onStep={step} s="seerPick" variant="mystic" disabled={!seer!.opened}>
            请预言家选择要查验的玩家
          </StepButton>
        </>
      )
      break
    case 'seer_pick':
      body = (
        <>
          <Info tone={seer!.confirmed ? 'ok' : 'wait'}>
            {seer!.selection === null ? '预言家正在选择…' : `预言家${seer!.confirmed ? '确认' : '正在看'} ${seatName(g, seer!.selection)}`}
          </Info>
          <StepButton onStep={step} s="seerReveal" variant="mystic" disabled={!seer!.confirmed}>
            验明身份
          </StepButton>
        </>
      )
      break
    case 'seer_result':
      body = (
        <>
          <Info tone={seer!.result === 'good' ? 'ok' : 'bad'}>
            {seatName(g, seer!.selection!)} 是 {seer!.result === 'good' ? '好人 👍' : '坏人 👎'}
          </Info>
          <StepButton onStep={step} s="seerClose" variant="stone">
            预言家请闭眼
          </StepButton>
        </>
      )
      break
    case 'witch_wake':
      body = !witch!.alive ? (
        <>
          <Info>女巫已出局（仍需走流程，避免泄露信息）</Info>
          <StepButton onStep={step} s="witchClose" variant="stone">
            女巫请闭眼
          </StepButton>
        </>
      ) : (
        <>
          <Info tone={witch!.opened ? 'ok' : 'wait'}>{witch!.opened ? '女巫已睁眼' : '等待女巫睁眼… 0/1'}</Info>
          <StepButton onStep={step} s="witchInform" variant="moss" disabled={!witch!.opened}>
            告知死亡信息
          </StepButton>
        </>
      )
      break
    case 'witch_act':
      body = (
        <>
          <Info tone={witch!.acted ? 'ok' : 'wait'}>
            {!witch!.acted
              ? `女巫正在决定… ${witch!.canSeeVictim ? '' : '(解药已用完，不告知死讯)'}`
              : [witch!.saved && '使用了解药', witch!.poisoned !== null && `毒杀了 ${seatName(g, witch!.poisoned)}`].filter(Boolean).join('，') || '女巫没有用药'}
          </Info>
          <StepButton onStep={step} s="witchClose" variant="stone" disabled={!witch!.acted}>
            女巫请闭眼
          </StepButton>
        </>
      )
      break
    case 'day':
      body = (
        <StepButton onStep={step} s="voteStart">
          <Vote /> 开始投票
        </StepButton>
      )
      break
    case 'hunter':
      body = <Info>等待 {seatName(g, g.hunter!.seat)}（猎人）选择是否带人…</Info>
      break
    case 'voting': {
      const v = g.vote!
      const done = v.voters.filter((s) => v.ballots[s]?.confirmed).length
      body = (
        <Info>
          {v.round > 1 ? 'PK ' : ''}投票中… 已确认 {done}/{v.voters.length}
        </Info>
      )
      break
    }
    case 'vote_result': {
      const r = g.vote!.result!
      body = r.resolved ? (
        <>
          <Info>{r.note}</Info>
          <StepButton onStep={step} s="nightStart">
            <Moon /> 天黑请闭眼
          </StepButton>
        </>
      ) : choosingTie ? (
        <>
          <Info>指定出局的玩家：</Info>
          <div className="flex flex-wrap justify-center gap-2">
            {r.tie!.map((s) => (
              <Button
                key={s}
                variant="blood"
                size="lg2"
                onClick={() => {
                  send({ type: 'tieChoose', seat: s })
                  setChoosingTie(false)
                }}
              >
                {seatName(g, s)}
              </Button>
            ))}
            <Button variant="ghost" size="lg2" onClick={() => setChoosingTie(false)}>
              返回
            </Button>
          </div>
        </>
      ) : (
        <>
          <Info tone="bad">{r.note}</Info>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="gold" size="lg2" className="px-1" onClick={() => step('tieRevote')}>
              PK 重投
            </Button>
            <Button variant="blood" size="lg2" className="px-1" onClick={() => setChoosingTie(true)}>
              指定出局
            </Button>
            <Button variant="stone" size="lg2" className="px-1" onClick={() => step('tieNone')}>
              无人出局
            </Button>
          </div>
        </>
      )
      break
    }
    case 'game_over':
      body = (
        <>
          <div className={cn('text-center font-display text-3xl', g.winner === 'wolf' ? 'text-red-400' : 'text-emerald-300')}>
            {g.winner === 'wolf' ? '🐺 狼人胜利' : '🏡 好人胜利'}
          </div>
          <StepButton onStep={step} s="reveal">公布结果</StepButton>
        </>
      )
      break
  }

  const showChat = !!w && ['wolf_wake', 'wolf_pick'].includes(g.phase)

  return (
    <div className="space-y-2">
      {body}
      {showChat && (
        <button className="mx-auto flex items-center gap-1 text-xs text-red-300" onClick={() => setChatOpen(true)}>
          <MessageSquare className="size-3.5" /> 狼人频道（{w!.chat.length}）
        </button>
      )}
      <Dialog open={chatOpen && showChat} onOpenChange={setChatOpen}>
        <DialogContent className="panel max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">狼人频道</DialogTitle>
          </DialogHeader>
          <WolfChat g={g} send={send} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
