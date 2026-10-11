import type { ReplayEvent, ReplayGameInfo } from '@shared/types'

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
  /** 该房间的第几局 */
  round: number
  /** 记录功能上线前的对局，只有最终局面 */
  backfilled: boolean
  /** 从数据库残留中恢复的对局 */
  recovered: boolean
  status: 'playing' | 'finished' | 'aborted'
  winner: 'wolf' | 'good' | null
  startedAt: number
  endedAt: number | null
  events: number
  judge: string
  players: number
}

/** 时间轴事件 */
export type GameEvent = ReplayEvent

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

/** 下载整局回放文件（.wwreplay） */
export async function downloadReplay(id: string) {
  const token = loadAdminToken()
  const res = await fetch(`/api/admin/games/${id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (res.status === 401) throw new AuthError('请重新登录')
  if (!res.ok) throw new Error('下载失败')
  const cd = res.headers.get('Content-Disposition') ?? ''
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? `werewolf-${id}.wwreplay`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const gameStatus = (g: Pick<ReplayGameInfo, 'status' | 'winner'>): [string, string] =>
  g.status === 'playing'
    ? ['进行中', 'bg-emerald-500/20 text-emerald-300']
    : g.status === 'aborted'
      ? ['已终止', 'bg-white/10 text-muted-foreground']
      : [g.winner === 'wolf' ? '狼人胜利' : '好人胜利', g.winner === 'wolf' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300']

export const duration = (g: Pick<ReplayGameInfo, 'startedAt' | 'endedAt' | 'backfilled'>) =>
  g.backfilled ? '用时未知' : g.endedAt ? `用时 ${Math.max(1, Math.round((g.endedAt - g.startedAt) / 60000))} 分钟` : '进行中'
