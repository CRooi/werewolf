import { useState, type ReactNode } from 'react'
import { ROLE_NAME, ROLE_ORDER, type StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { ChatBox, VoteBoard } from '../game/ActionPanels'
import { PHASE_TITLE, isNight } from '../game/helpers'
import { NightSummary } from '../game/Stage'
import { Table } from '../Overview'

type Tab = 'summary' | 'wolf' | 'ghost' | 'log' | 'ann' | 'extra'

/** 后台上帝视角：圆桌 + 侧栏（速览 / 频道 / 法官记录 / 公告） */
export function AdminBoard({ state, extraTab }: { state: StateView; extraTab?: { label: string; content: ReactNode } }) {
  const [tab, setTab] = useState<Tab>(extraTab ? 'extra' : 'summary')
  const g = state.game
  const c = state.room.config

  const tabs: [Tab, string][] = [
    ...(extraTab ? ([['extra', extraTab.label]] as [Tab, string][]) : []),
    ['summary', '速览'],
    ['wolf', `狼人频道${g?.wolf ? `（${g.wolf.chat.length}）` : ''}`],
    ['ghost', `观战频道${g?.ghostChat ? `（${g.ghostChat.length}）` : ''}`],
    ['log', '法官记录'],
    ['ann', '公告'],
  ]

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(320px,30vw)] gap-4">
      <div className="grid min-h-0">
        <Table state={state} g={g} />
      </div>
      <aside className="panel flex min-h-0 flex-col p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-lg text-gold-grad">
            {g ? `${g.phase === 'dealt' ? '准备' : isNight(g.phase) ? `第 ${g.day} 夜` : `第 ${g.day} 天`} · ${PHASE_TITLE[g.phase]}` : '未开局'}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {ROLE_ORDER.filter((r) => c[r] > 0)
              .map((r) => `${ROLE_NAME[r]}×${c[r]}`)
              .join(' ')}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('rounded-full px-3 py-1 text-xs transition', tab === k ? 'bg-gold text-[#2a1a05]' : 'bg-black/30 text-gold-soft hover:bg-black/50')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'extra' && extraTab?.content}
          {tab === 'summary' &&
            (g ? (
              <div className="space-y-3">
                <NightSummary g={g} />
                {g.vote && ['voting', 'vote_result', 'idiot'].includes(g.phase) && (
                  <div className="space-y-2">
                    <div className="text-xs text-gold-soft/70">{g.vote.round > 1 ? 'PK 投票' : '投票'}</div>
                    <VoteBoard g={g} canVote={false} />
                    {g.vote.result && <div className="rounded-lg bg-black/30 px-3 py-2 text-sm">{g.vote.result.note}</div>}
                  </div>
                )}
                {g.winner && <div className="rounded-lg bg-black/30 px-3 py-2 text-sm">胜负：{g.winner === 'wolf' ? '狼人胜利' : '好人胜利'}</div>}
              </div>
            ) : (
              <Empty text="房间还没有开始对局" />
            ))}
          {tab === 'wolf' && (g?.wolf ? <ChatBox messages={g.wolf.chat} selfId="" emptyText="狼人频道还没有消息" listClassName="max-h-none" /> : <Empty text="暂无" />)}
          {tab === 'ghost' &&
            (g?.ghostChat ? <ChatBox tone="mystic" messages={g.ghostChat} selfId="" emptyText="观战频道还没有消息" listClassName="max-h-none" /> : <Empty text="暂无" />)}
          {tab === 'log' && <Lines lines={g?.judgeLog ?? []} />}
          {tab === 'ann' && <Lines lines={(g?.announcements ?? []).map((a) => `第${a.day}天 · ${a.text}`)} />}
        </div>
      </aside>
    </div>
  )
}

function Lines({ lines }: { lines: string[] }) {
  if (!lines.length) return <Empty text="暂无记录" />
  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((l, i) => (
        <div key={i} className="rounded-lg bg-black/30 px-3 py-1.5">
          {l}
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
}
