import { EyeOff } from 'lucide-react'

/** 观战提示：观战席与出局玩家常驻显示；locked 为第一天出局、尚未解锁观战的玩家 */
export function WatchBanner({ dead, locked }: { dead?: boolean; locked?: boolean }) {
  return (
    <div className="sticky top-0 z-20 -mx-3 mb-2 flex items-center justify-center gap-1.5 bg-red-600/95 px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.8)]">
      <EyeOff className="size-3.5 shrink-0" />
      {locked ? '你已出局，第二晚起可进入观战：请保持安静，不要透露任何信息' : `${dead ? '你已出局，正在观战' : '观战中'}：请保持安静，不要透露任何信息`}
    </div>
  )
}
