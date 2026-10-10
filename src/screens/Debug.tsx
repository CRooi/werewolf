import { useCallback, useEffect, useState } from 'react'
import { Bug, ExternalLink, Plus, Trash2, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CONFIG, seatCount, type RoomConfig } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Scenery } from '@/components/art/Scenery'
import { ConfigForm } from '@/components/game/ConfigForm'
import { api, loadName, loadSession, saveName, saveSession, type Session } from '@/lib/session'

const MAX_SLOT = 20

/** 首字各不相同，方便在头像上区分 */
const NAMES = ['法官', '阿狸', '白菜', '橙子', '大熊', '鹅鹅', '饭团', '果冻', '荷包', '冰糖', '金桔', '可乐', '柠檬', '蘑菇', '奶茶', '泡芙', '青团', '肉松', '薯条', '汤圆']

interface SlotInfo {
  slot: number
  name: string
  session: Session
}

function readSlots(): SlotInfo[] {
  const out: SlotInfo[] = []
  for (let slot = 0; slot < MAX_SLOT; slot++) {
    const session = loadSession(slot)
    if (session) out.push({ slot, name: loadName(slot), session })
  }
  return out
}

const slotUrl = (slot: number) => `${location.pathname}?slot=${slot}`

/** 打开槽位标签页；同名窗口已存在时复用 */
function openSlot(slot: number) {
  return window.open(slotUrl(slot), `ww-slot-${slot}`)
}

/**
 * 调试台：在同一个浏览器里模拟多名玩家。
 * 每个槽位对应一个带 ?slot=N 的标签页，拥有独立的身份存储。
 */
export function Debug() {
  const [slots, setSlots] = useState<SlotInfo[]>(readSlots)
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => setSlots(readSlots()), [])

  useEffect(() => {
    document.title = '调试台 - 狼人杀'
    // 其他标签页退出房间时同步刷新
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const freeSlots = (count: number, from: number) => {
    const used = new Set(readSlots().map((s) => s.slot))
    const res: number[] = []
    for (let s = from; s < MAX_SLOT && res.length < count; s++) if (!used.has(s)) res.push(s)
    if (res.length < count) throw new Error(`槽位不足，最多 ${MAX_SLOT} 个，请先清理`)
    return res
  }

  const joinPlayers = async (roomCode: string, count: number) => {
    const targets = freeSlots(count, 1)
    for (const slot of targets) {
      const name = NAMES[slot] ?? `玩家${slot}`
      const s = await api<Session>(`/api/rooms/${roomCode}/join`, { name })
      saveSession(s, slot)
      saveName(name, slot)
    }
    return targets
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const quickStart = () =>
    run(async () => {
      if (loadSession(0)) throw new Error('槽位 0 已被占用，请先清理')
      const judge = await api<Session>('/api/rooms', { name: '法官', config })
      saveSession(judge, 0)
      saveName('法官', 0)
      await joinPlayers(judge.code, seatCount(config))
      setCode(judge.code)
      toast.success(`房间 ${judge.code} 已创建并坐满`)
    })

  const fill = () =>
    run(async () => {
      if (!/^\d{4}$/.test(code)) throw new Error('请输入 4 位房间码')
      const info = await api<{ seats: number; seated: number }>(`/api/rooms/${code}`)
      const n = info.seats - info.seated
      if (n <= 0) throw new Error('房间已经坐满')
      await joinPlayers(code, n)
      toast.success(`已加入 ${n} 名玩家`)
    })

  const addOne = () =>
    run(async () => {
      if (!/^\d{4}$/.test(code)) throw new Error('请输入 4 位房间码')
      await joinPlayers(code, 1)
    })

  const clearSlot = (slot: number) => {
    saveSession(null, slot)
    refresh()
  }

  /** 移除某个房间的全部调试槽位（仅清理本地记录） */
  const clearRoom = (room: string) => {
    for (const s of readSlots()) if (s.session.code === room) saveSession(null, s.slot)
    refresh()
  }

  const clearAll = () => {
    for (const s of readSlots()) saveSession(null, s.slot)
    refresh()
  }

  const openAll = () => {
    let blocked = 0
    for (const s of slots) if (!openSlot(s.slot)) blocked++
    if (blocked) toast.error(`有 ${blocked} 个标签页被浏览器拦截，请允许本站弹出窗口，或逐个点击打开`)
  }

  const rooms = [...new Set(slots.map((s) => s.session.code))]

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pb-8 safe-top">
      <Scenery night dim />
      <header className="flex items-center gap-2 pt-3">
        <Bug className="size-6 text-fuchsia-400" />
        <h1 className="font-display text-3xl text-gold-grad">调试台</h1>
        <a href={location.pathname} className="ml-auto text-xs text-muted-foreground underline">
          返回首页
        </a>
      </header>
      <p className="text-xs leading-relaxed text-muted-foreground">
        每个「槽位」是一个带 <code className="text-gold-soft">?slot=N</code> 的独立标签页，拥有自己的身份，互不影响。创建或加入后点「打开」即可进入对应玩家的视角。
      </p>

      {/* 一键开局 */}
      <section className="panel space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-gold-soft">
          <Zap className="size-5" /> 一键开局
        </h2>
        <p className="text-xs text-muted-foreground">槽位 0 创建房间当法官，其余座位自动由槽位 1、2、3… 坐满</p>
        <ConfigForm value={config} onChange={setConfig} />
        <Button variant="gold" size="xl" className="w-full" disabled={busy} onClick={quickStart}>
          创建房间并坐满 {seatCount(config)} 人
        </Button>
      </section>

      {/* 加入已有房间 */}
      <section className="panel space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-gold-soft">
          <Users className="size-5" /> 加入已有房间
        </h2>
        <div className="flex gap-2">
          <Input
            value={code}
            inputMode="numeric"
            maxLength={4}
            placeholder="房间码"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="h-10 bg-black/30 text-center font-display text-xl tracking-[0.4em]"
          />
          <Button variant="stone" size="lg2" disabled={busy} onClick={addOne}>
            <Plus /> 1 人
          </Button>
          <Button variant="gold" size="lg2" disabled={busy} onClick={fill}>
            补满空位
          </Button>
        </div>
        <Button
          variant="stone"
          size="lg2"
          className="w-full"
          onClick={() => {
            try {
              openSlot(freeSlots(1, 1)[0]!)
            } catch (e) {
              toast.error((e as Error).message)
            }
          }}
        >
          <ExternalLink /> 打开空白玩家（手动取名入座）
        </Button>
      </section>

      {/* 槽位列表 */}
      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="whitespace-nowrap font-display text-xl text-gold-soft">玩家标签页</h2>
          <span className="whitespace-nowrap text-xs text-muted-foreground">{slots.length} 个</span>
          <div className="ml-auto flex gap-2">
            <Button variant="stone" size="sm" disabled={!slots.length} onClick={openAll}>
              <ExternalLink /> 全部打开
            </Button>
            <Button variant="destructive" size="sm" disabled={!slots.length} onClick={clearAll}>
              <Trash2 /> 清空
            </Button>
          </div>
        </div>
        {slots.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">还没有玩家，先在上面创建或加入房间</div>
        ) : (
          rooms.map((room) => (
            <div key={room} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gold-soft/70">房间 {room}</span>
                <button type="button" className="flex items-center gap-1 text-xs text-red-300/80" onClick={() => clearRoom(room)}>
                  <Trash2 className="size-3.5" /> 移除该房间
                </button>
              </div>
              {slots
                .filter((s) => s.session.code === room)
                .map((s) => (
                  <div key={s.slot} className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-fuchsia-600/80 text-xs font-bold text-white">{s.slot}</span>
                    <span className="flex-1 truncate text-sm">{s.name || '(未命名)'}</span>
                    <Button variant="gold" size="sm" onClick={() => openSlot(s.slot)}>
                      打开
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => clearSlot(s.slot)} aria-label="清除槽位">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
            </div>
          ))
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          「全部打开」需要允许本站弹出窗口。清除槽位只会清掉本地记录，不会让玩家离开房间。
        </p>
      </section>
    </div>
  )
}
