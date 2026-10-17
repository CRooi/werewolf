import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/art/icons'
import { clearUpgradedParam, justUpgraded } from '@/lib/upgrade'

/** 更新后刷新回来时，提示至少展示这么久，避免一闪而过 */
const MIN_MS = 1000
/** 最多展示这么久，迟迟连不上时交给普通的重连提示 */
const MAX_MS = 3000

/** 刷新回来的提示只处理一次；计时从页面加载算起，组件换位置重新挂载也不会重新计时 */
let handled = false
const pageStart = Date.now()

/**
 * 「系统更新中」全屏提示：
 * - upgrading：后端通知即将重启，断线期间显示；
 * - 后端更新后页面自动刷新回来时显示 1～3 秒，等 ready（收到房间状态）后回到游戏。
 */
export function SystemUpdating({ upgrading, ready }: { upgrading: boolean; ready: boolean }) {
  const [returning, setReturning] = useState(() => justUpgraded && !handled)

  useEffect(() => {
    if (!returning) return
    const finish = () => {
      handled = true
      setReturning(false)
      clearUpgradedParam()
      toast.success('系统更新完成')
    }
    const elapsed = Date.now() - pageStart
    const t = setTimeout(finish, Math.max(0, (ready ? MIN_MS : MAX_MS) - elapsed))
    return () => clearTimeout(t)
  }, [returning, ready])

  if (!upgrading && !returning) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#0b0a1a]/90 px-6 text-center backdrop-blur-sm">
      <Logo className="size-20" />
      <div className="flex items-center gap-2 font-display text-2xl text-gold-grad">
        <Loader2 className="size-6 animate-spin text-gold" /> 系统更新中
      </div>
      <div className="text-sm text-muted-foreground">请稍候，马上回到游戏，对局进度会自动保留</div>
    </div>
  )
}
