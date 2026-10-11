import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileVideo, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ReplayFile, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/art/icons'
import { Scenery } from '@/components/art/Scenery'
import { ReplayPlayer } from './admin/ReplayPlayer'

/** 读取回放文件：支持 gzip 压缩的 .wwreplay 与未压缩的 JSON */
async function readReplayFile(file: File): Promise<ReplayFile> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let text: string
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    text = await new Response(stream).text()
  } else {
    text = new TextDecoder().decode(buf)
  }
  let data: ReplayFile
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('无法解析这个文件，请选择从后台下载的 .wwreplay 回放文件')
  }
  if (data?.format !== 'werewolf-replay' || !Array.isArray(data.events)) throw new Error('这不是狼人杀回放文件')
  if (data.version > 1) throw new Error('回放文件版本过新，请先更新页面')
  return data
}

/**
 * 本地回放查看器：?replay
 * 选择从后台下载的回放文件，在浏览器里直接读取并回放，不需要登录也不请求服务器。
 */
export function ReplayViewer() {
  const [replay, setReplay] = useState<ReplayFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = replay ? `回放 · 房间 ${replay.game.code} 第 ${replay.game.round} 局 - 狼人杀` : '回放查看器 - 狼人杀'
  }, [replay])

  const open = useCallback(async (file: File | undefined) => {
    if (!file) return
    try {
      const data = await readReplayFile(file)
      setReplay(data)
      setFileName(file.name)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  const views = useMemo(() => new Map(replay?.events.map((e) => [e.seq, e.view]) ?? []), [replay])
  const loadView = useCallback((seq: number) => {
    const v = views.get(seq)
    return v ? Promise.resolve<StateView>(v) : Promise.reject(new Error('回放文件缺少该时间点的局面'))
  }, [views])
  const events = useMemo(() => replay?.events.map(({ view: _view, ...e }) => e) ?? [], [replay])

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept=".wwreplay,.json,application/gzip,application/json"
      className="hidden"
      onChange={(e) => {
        open(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  if (replay) {
    return (
      <div className="flex h-dvh flex-col gap-4 px-6 py-4">
        <Scenery night dim />
        {picker}
        <header className="flex items-center gap-3">
          <Logo className="size-10" />
          <h1 className="font-display text-2xl text-gold-grad">回放查看器</h1>
          <span className="truncate text-xs text-muted-foreground">{fileName}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="stone" size="sm" onClick={() => inputRef.current?.click()}>
              <FolderOpen /> 打开其他回放
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReplay(null)}>
              <X /> 关闭
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <ReplayPlayer key={replay.game.id + replay.exportedAt} game={replay.game} events={events} loadView={loadView} onError={(e) => toast.error((e as Error).message)} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        open(e.dataTransfer.files?.[0])
      }}
    >
      <Scenery night dim />
      {picker}
      <Logo className="size-28" />
      <h1 className="flex items-center gap-3 font-display text-4xl text-gold-grad">
        <FileVideo className="size-8 text-gold" /> 回放查看器
      </h1>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'panel flex w-full max-w-md flex-col items-center gap-3 border-dashed p-10 text-center transition',
          dragging && 'border-gold bg-gold/10',
        )}
      >
        <FolderOpen className="size-10 text-gold" />
        <div className="font-display text-xl text-gold-soft">选择或拖入回放文件</div>
        <div className="text-sm text-muted-foreground">在后台「对局记录」中点击「下载」得到的 .wwreplay 文件</div>
      </button>
      <p className="max-w-md text-center text-xs text-muted-foreground">文件只在你的浏览器里读取和播放，不会上传到任何服务器。</p>
    </div>
  )
}
