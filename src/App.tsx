import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { cleanUrl, loadName, loadSession, saveSession, SLOT, type Session } from '@/lib/session'
import { Admin } from '@/screens/admin/Admin'
import { Debug } from '@/screens/Debug'
import { Home } from '@/screens/Home'
import { Overview } from '@/screens/Overview'
import { RoomScreen } from '@/screens/RoomScreen'

const params = new URLSearchParams(location.search)
const IS_DEBUG_PAGE = params.has('debug')
const IS_OVERVIEW = params.has('overview')
const IS_ADMIN = params.has('admin')

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const enter = (s: Session | null) => {
    saveSession(s)
    setSession(s)
    // 进入房间后去掉分享链接上的房间号
    if (s) cleanUrl()
  }

  // 调试槽位：标签页标题带上槽位与名字，方便区分
  useEffect(() => {
    if (SLOT !== null && !IS_DEBUG_PAGE) document.title = `[${SLOT}] ${loadName() || '新玩家'} - 狼人杀`
  }, [session])

  if (IS_OVERVIEW) return <Overview />

  if (IS_ADMIN) {
    return (
      <>
        <Admin />
        <Toaster position="top-center" richColors closeButton={false} />
      </>
    )
  }

  if (IS_DEBUG_PAGE) {
    return (
      <>
        <Debug />
        <Toaster position="top-center" richColors closeButton={false} />
      </>
    )
  }

  return (
    <>
      {session ? <RoomScreen key={session.token} session={session} onExit={() => enter(null)} /> : <Home onEnter={enter} />}
      {SLOT !== null && (
        <div className="pointer-events-none fixed top-1 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-fuchsia-600/85 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          调试槽位 {SLOT}
        </div>
      )}
      <Toaster position="top-center" richColors closeButton={false} />
    </>
  )
}
