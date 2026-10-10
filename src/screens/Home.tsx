import { useState } from 'react'
import { ArrowLeft, Bug, DoorOpen, Eye, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CONFIG, type RoomConfig } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/art/icons'
import { Scenery } from '@/components/art/Scenery'
import { ConfigForm } from '@/components/game/ConfigForm'
import { api, loadName, saveName, type Session } from '@/lib/session'

type Mode = 'menu' | 'create' | 'join'

/** 开发环境或构建时设置 VITE_DEBUG=1 时在首页显示调试台入口（调试台本身始终可通过 ?debug 访问） */
const SHOW_DEBUG_LINK = import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1'

export function Home({ onEnter }: { onEnter: (s: Session) => void }) {
  const initialCode = new URLSearchParams(location.search).get('room') ?? ''
  const [name, setName] = useState(loadName)
  const [mode, setMode] = useState<Mode>(initialCode ? 'join' : 'menu')
  const [code, setCode] = useState(initialCode)
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG)
  const [busy, setBusy] = useState(false)

  const needName = () => {
    const n = name.trim()
    if (!n) {
      toast.error('请先给自己取个名字')
      return null
    }
    saveName(n)
    return n
  }

  const create = async () => {
    const n = needName()
    if (!n) return
    setBusy(true)
    try {
      onEnter(await api<Session>('/api/rooms', { name: n, config }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const join = async (as: 'join' | 'spectate' = 'join') => {
    const n = needName()
    if (!n) return
    if (!/^\d{4}$/.test(code)) return void toast.error('请输入 4 位房间码')
    setBusy(true)
    try {
      onEnter(await api<Session>(`/api/rooms/${code}/${as}`, { name: n }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 safe-top safe-bottom">
      <Scenery night />
      {mode === 'menu' ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center pt-6">
            <Logo className="size-44" />
            <h1 className="mt-2 font-display text-5xl text-gold-grad drop-shadow">狼人杀</h1>
            {/* <p className="mt-2 text-sm tracking-[0.3em] text-gold-soft/70">天各一方 · 同一个夜晚</p> */}
          </div>
          <div className="panel animate-rise space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="font-display text-sm text-gold-soft">你的名字</label>
              <Input
                value={name}
                maxLength={12}
                onChange={(e) => setName(e.target.value)}
                placeholder="给自己取个名字"
                className="h-11 bg-black/30 text-base"
              />
            </div>
            <Button variant="gold" size="xl" className="w-full" onClick={() => needName() && setMode('create')}>
              <Sparkles /> 创建房间（当法官）
            </Button>
            <Button variant="stone" size="xl" className="w-full" onClick={() => needName() && setMode('join')}>
              <DoorOpen /> 加入房间
            </Button>
          </div>
          <div className="flex h-10 items-center justify-center">
            {SHOW_DEBUG_LINK && (
              <a href="?debug" className="flex items-center gap-1 text-xs text-fuchsia-300/80 underline">
                <Bug className="size-3.5" /> 调试台
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col pt-2">
          <button className="mb-3 flex items-center gap-1 self-start text-sm text-gold-soft/80" onClick={() => setMode('menu')}>
            <ArrowLeft className="size-4" /> 返回
          </button>
          {mode === 'create' ? (
            <div className="panel animate-rise flex min-h-0 flex-1 flex-col p-4">
              <h2 className="mb-1 text-center font-display text-2xl text-gold-grad">配置本局板子</h2>
              <p className="mb-3 text-center text-xs text-muted-foreground">法官：{name}</p>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                <ConfigForm value={config} onChange={setConfig} />
              </div>
              <Button variant="gold" size="xl" className="mt-3 w-full" disabled={busy} onClick={create}>
                建立房间
              </Button>
            </div>
          ) : (
            <div className="panel animate-rise space-y-5 p-5">
              <h2 className="text-center font-display text-2xl text-gold-grad">输入房间码</h2>
              <Input
                value={name}
                maxLength={12}
                onChange={(e) => setName(e.target.value)}
                placeholder="先给自己取个名字"
                className="h-11 bg-black/30 text-center text-base"
              />
              <div className="relative">
                <Input
                  value={code}
                  autoFocus={!!name}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-16 bg-black/30 text-center font-display text-4xl tracking-[0.6em] text-gold-soft caret-gold"
                  placeholder="····"
                  onKeyDown={(e) => e.key === 'Enter' && join()}
                />
              </div>
              <Button variant="gold" size="xl" className="w-full" disabled={busy || code.length !== 4 || !name.trim()} onClick={() => join()}>
                入座
              </Button>
              <Button variant="stone" size="lg2" className="w-full" disabled={busy || code.length !== 4 || !name.trim()} onClick={() => join('spectate')}>
                <Eye /> 观战（房间需允许观战）
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
