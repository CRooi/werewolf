import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { ReplayEvent, ReplayGameInfo, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AdminBoard } from './AdminBoard'
import { duration, fmtDateTime, fmtTime, gameStatus } from './adminApi'

const SPEEDS = [1, 2, 4]

/**
 * 对局回放播放器：时间轴 + 圆桌 + 侧栏。
 * 数据来源可替换：后台按需从服务端加载，本地查看器从文件中读取。
 */
export function ReplayPlayer({
  game,
  events,
  loadView,
  onError,
  actions,
}: {
  game: ReplayGameInfo
  events: ReplayEvent[]
  /** 取某个事件时刻的上帝视角 */
  loadView: (seq: number) => Promise<StateView>
  onError?: (e: unknown) => void
  /** 标题栏右侧的额外按钮（如下载） */
  actions?: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [views, setViews] = useState<Record<number, StateView>>({})
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const listRef = useRef<HTMLDivElement>(null)
  const current = events[index]

  // 按需加载某个时间点的局面，并预取下一个
  useEffect(() => {
    if (!current) return
    for (const ev of [current, events[index + 1]]) {
      if (!ev || views[ev.seq]) continue
      loadView(ev.seq).then((v) => setViews((m) => ({ ...m, [ev.seq]: v })), onError)
    }
  }, [current, events, index, views, loadView, onError])

  // 自动播放：播到最后一个事件自然停止
  const isPlaying = playing && index < events.length - 1
  useEffect(() => {
    if (!isPlaying) return
    const t = setTimeout(() => setIndex((i) => i + 1), 1200 / speed)
    return () => clearTimeout(t)
  }, [isPlaying, index, speed])

  // 当前事件滚动到可视区域
  useEffect(() => {
    listRef.current?.querySelector(`[data-seq="${current?.seq}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current?.seq])

  // ← → 切换事件，空格播放 / 暂停
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(events.length - 1, i + 1))
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [events.length])

  if (!events.length) return <div className="py-20 text-center text-gold-soft">这局没有记录到事件</div>

  // 无快照时显示最近一次已加载的局面，避免闪烁
  const view = (() => {
    for (let i = index; i >= 0; i--) {
      const v = views[events[i]!.seq]
      if (v) return v
    }
    return null
  })()
  const elapsed = current ? current.ts - game.startedAt : 0
  const [statusLabel, statusCls] = gameStatus(game)

  const timeline = (
    <div ref={listRef} className="space-y-1">
      {events.map((ev, i) => (
        <button
          key={ev.seq}
          data-seq={ev.seq}
          onClick={() => {
            setIndex(i)
            setPlaying(false)
          }}
          className={cn(
            'flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
            i === index ? 'bg-gold/25 ring-1 ring-gold/60' : i < index ? 'bg-black/30 text-white/70' : 'bg-black/15 text-white/45 hover:bg-black/30',
          )}
        >
          <span className="shrink-0 font-mono text-muted-foreground">{fmtTime(ev.ts)}</span>
          <span className="shrink-0 text-gold-soft">{ev.actor}</span>
          <span className="min-w-0 flex-1 break-words">{ev.text}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-display text-xl text-gold-soft">
          房间 {game.code} · 第 {game.round} 局
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs', statusCls)}>{statusLabel}</span>
        <span className="text-muted-foreground">
          {game.backfilled ? `${fmtDateTime(game.startedAt)} 最后操作` : `${fmtDateTime(game.startedAt)} 发牌`} · {duration(game)} · {events.length} 个事件
        </span>
        {game.recovered && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">从数据库残留恢复，操作者由前后局面推断</span>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {events.length <= 1 && (
        <div className="rounded-lg bg-black/40 px-4 py-2 text-sm text-amber-200">这局开始于记录功能上线之前，只保存了最终局面，没有可回放的过程。</div>
      )}
      <div className="min-h-0 flex-1">
        {view ? <AdminBoard state={view} extraTab={{ label: '时间轴', content: timeline }} /> : <div className="py-20 text-center text-gold-soft">加载局面…</div>}
      </div>

      {/* 时间轴控制条（只有一个事件时没有过程可回放，不显示） */}
      {events.length > 1 && (
        <div className="panel flex items-center gap-3 px-4 py-3">
          <Button variant="stone" size="icon-lg" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="上一步">
            <ChevronLeft />
          </Button>
          <Button
            variant="gold"
            size="icon-lg"
            onClick={() => {
              if (index >= events.length - 1) setIndex(0)
              setPlaying(!isPlaying)
            }}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button variant="stone" size="icon-lg" onClick={() => setIndex((i) => Math.min(events.length - 1, i + 1))} aria-label="下一步">
            <ChevronRight />
          </Button>
          <button className="rounded-full bg-black/40 px-2.5 py-1 text-xs text-gold-soft" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}>
            {speed}×
          </button>
          <input
            type="range"
            min={0}
            max={events.length - 1}
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value))
              setPlaying(false)
            }}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[#e8b45a]"
          />
          <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {index + 1}/{events.length}
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
            +{Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}
          </span>
        </div>
      )}
      {current && (
        <div className="-mt-1 truncate px-1 text-sm">
          <span className="font-mono text-muted-foreground">{fmtTime(current.ts)}</span>
          <span className="mx-2 text-gold-soft">{current.actor}</span>
          {current.text}
        </div>
      )}
    </div>
  )
}
