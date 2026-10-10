import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { loadSession, saveSession, type Session } from '@/lib/session'
import { Home } from '@/screens/Home'
import { RoomScreen } from '@/screens/RoomScreen'

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const enter = (s: Session | null) => {
    saveSession(s)
    setSession(s)
    // 进入房间后去掉分享链接上的房间号
    if (s && location.search) history.replaceState(null, '', location.pathname)
  }

  return (
    <>
      {session ? <RoomScreen key={session.token} session={session} onExit={() => enter(null)} /> : <Home onEnter={enter} />}
      <Toaster position="top-center" richColors closeButton={false} />
    </>
  )
}
