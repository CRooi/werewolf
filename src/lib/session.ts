export interface Session {
  code: string
  token: string
}

/**
 * 调试槽位：URL 带 ?slot=N 时，本标签页使用独立的存储命名空间，
 * 同一浏览器里的多个标签页就是互相独立的玩家。
 */
export const SLOT: number | null = (() => {
  const v = new URLSearchParams(location.search).get('slot')
  return v !== null && /^\d{1,2}$/.test(v) ? Number(v) : null
})()

const prefix = (slot: number | null) => (slot === null ? 'ww.' : `ww.s${slot}.`)
const nameKey = (slot: number | null) => `${prefix(slot)}name`
const sessionKey = (slot: number | null) => `${prefix(slot)}session`

function get(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* 隐私模式等情况下忽略 */
  }
}

export const loadName = (slot = SLOT) => get(nameKey(slot)) ?? ''
export const saveName = (n: string, slot = SLOT) => set(nameKey(slot), n)

export function loadSession(slot = SLOT): Session | null {
  try {
    const s = JSON.parse(get(sessionKey(slot)) ?? 'null')
    return s && s.code && s.token ? s : null
  } catch {
    return null
  }
}

export const saveSession = (s: Session | null, slot = SLOT) => set(sessionKey(slot), s ? JSON.stringify(s) : null)

/** 本标签页专属的 sessionStorage 键（同一标签页切换槽位时互不干扰） */
export const tabKey = (k: string) => `${prefix(SLOT)}${k}`

/** 进入房间后清理 URL 参数，保留调试槽位 */
export function cleanUrl() {
  const q = SLOT === null ? '' : `?slot=${SLOT}`
  if (location.search !== q) history.replaceState(null, '', location.pathname + q)
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '网络错误')
  return data as T
}
