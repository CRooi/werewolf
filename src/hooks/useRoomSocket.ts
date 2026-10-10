import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ClientMessage, ServerMessage, StateView } from '@shared/types'
import type { Session } from '@/lib/session'

export type ConnStatus = 'connecting' | 'open' | 'closed'

/** 连接房间 WebSocket，断线自动重连 */
export function useRoomSocket(session: Session, onKicked: (reason: string) => void) {
  const [state, setState] = useState<StateView | null>(null)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const kickedRef = useRef(onKicked)
  useEffect(() => {
    kickedRef.current = onKicked
  })

  useEffect(() => {
    let stopped = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined

    const connect = () => {
      if (stopped) return
      setStatus('connecting')
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws?code=${encodeURIComponent(session.code)}&token=${encodeURIComponent(session.token)}`)
      wsRef.current = ws
      ws.onopen = () => {
        retry = 0
        setStatus('open')
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' })), 20000)
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage
        switch (msg.type) {
          case 'state':
            setState(msg.state)
            break
          case 'error':
            toast.error(msg.message)
            break
          case 'swapResult':
            if (msg.accepted) toast.success(`${msg.by} 同意了交换位置`)
            else toast(`${msg.by} 拒绝了交换位置`)
            break
          case 'kicked':
            stopped = true
            kickedRef.current(msg.reason)
            break
        }
      }
      ws.onclose = () => {
        clearInterval(ping)
        if (wsRef.current === ws) wsRef.current = null
        if (stopped) return
        setStatus('closed')
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 8000))
      }
    }
    connect()

    // 手机切回前台时立即重连
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wsRef.current && !stopped) {
        clearTimeout(timer)
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ping)
      document.removeEventListener('visibilitychange', onVisible)
      wsRef.current?.close()
    }
  }, [session.code, session.token])

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    else toast.error('连接已断开，正在重连…')
  }, [])

  return { state, status, send }
}
