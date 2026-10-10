import { useEffect, useState } from 'react'
import type { ServerMessage, StateView } from '@shared/types'
import type { ConnStatus } from './useRoomSocket'

/** 大屏观战：只读连接，断线自动重连 */
export function useSpectator(code: string) {
  const [state, setState] = useState<StateView | null>(null)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [gone, setGone] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let retry = 0
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined

    const connect = () => {
      if (stopped) return
      setStatus('connecting')
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws?spectate=1&code=${encodeURIComponent(code)}`)
      ws.onopen = () => {
        retry = 0
        setStatus('open')
        setGone(null)
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' })), 20000)
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage
        if (msg.type === 'state') setState(msg.state)
        if (msg.type === 'kicked') {
          // 房间解散后继续轮询，法官用同一房间码重建时可自动恢复
          setGone(msg.reason)
          setState(null)
        }
      }
      ws.onclose = () => {
        clearInterval(ping)
        if (stopped) return
        setStatus('closed')
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 8000))
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ping)
      ws?.close()
    }
  }, [code])

  return { state, status, gone }
}
