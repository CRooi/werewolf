import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/components/art/icons'
import { Scenery } from '@/components/art/Scenery'
import { clearUpgradedParam, justUpgraded } from '@/lib/upgrade'

/** 更新后刷新回来时，提示至少展示这么久，避免一闪而过 */
const MIN_MS = 1000
/** 最多展示这么久，迟迟连不上时交给普通的重连提示 */
const MAX_MS = 3000

/** 刷新回来的提示只处理一次；计时从页面加载算起，组件换位置重新挂载也不会重新计时 */
let handled = false
const pageStart = Date.now()

const STEPS = ['正在唤醒新的月光', '正在重铸游戏规则', '正在召回各位玩家', '正在恢复对局进度']

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
  return <UpdatingScreen />
}

function UpdatingScreen() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 700)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 overflow-hidden bg-[#05071a] px-6 text-center animate-in fade-in duration-300">
      <Scenery night />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgb(232_180_90/0.18),transparent_55%)]" />

      {/* 月环 + 符文圈 */}
      <div className="relative flex size-64 items-center justify-center">
        <div className="animate-halo absolute inset-6 rounded-full bg-[radial-gradient(circle,rgb(255_222_150/0.35),transparent_70%)] blur-md" />
        <svg viewBox="0 0 200 200" className="animate-orbit absolute inset-0 size-full text-gold/70">
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 30} 100 100)`}>
              <path d="M100 2 l3 6 -3 6 -3 -6z" fill="currentColor" />
            </g>
          ))}
        </svg>
        <svg viewBox="0 0 200 200" className="animate-orbit-rev absolute inset-7 size-[calc(100%-3.5rem)] text-gold-soft/60">
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="40 14 4 14" />
        </svg>
        <div className="animate-glow relative flex size-32 items-center justify-center rounded-full border border-gold/50 bg-[radial-gradient(circle_at_35%_30%,#2a2550,#0b0a1f)]">
          <Logo className="animate-float size-20" />
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="font-display text-4xl tracking-[0.35em] text-gold-grad sm:text-5xl">系统更新中</div>
        <div key={step} className="animate-rise h-5 text-sm tracking-widest text-gold-soft/80">
          {STEPS[step]}…
        </div>
      </div>

      {/* 进度扫光 */}
      <div className="relative h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-gold/20">
        <div className="animate-scan absolute inset-y-0 w-2/5 rounded-full bg-[linear-gradient(90deg,transparent,#ffe9b0,#e8b45a,transparent)]" />
      </div>

      <p className="relative text-xs text-muted-foreground">请稍候，马上回到游戏，对局进度会自动保留</p>
    </div>
  )
}
