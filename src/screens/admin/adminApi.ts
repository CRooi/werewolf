const KEY = 'ww.admin'

export const loadAdminToken = () => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveAdminToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(KEY, t)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export class AuthError extends Error {}

/** 带管理员令牌的请求；令牌失效时抛出 AuthError */
export async function adminApi<T>(path: string, body?: unknown): Promise<T> {
  const token = loadAdminToken()
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.error ?? '请重新登录')
  if (!res.ok) throw new Error(data.error ?? '网络错误')
  return data as T
}

export interface AdminRoom {
  code: string
  judge: string
  seats: number
  seated: number
  spectators: number
  inGame: boolean
  phase: string | null
  day: number | null
  gameId: string | null
  createdAt: number
  lastActiveAt: number
  idleTimeoutMs: number
}

export interface AdminGame {
  id: string
  code: string
  status: 'playing' | 'finished' | 'aborted'
  winner: 'wolf' | 'good' | null
  startedAt: number
  endedAt: number | null
  events: number
  judge: string
  players: number
}

export interface GameEvent {
  seq: number
  ts: number
  actor: string
  text: string
  phase: string
  day: number
}

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
