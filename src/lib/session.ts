export interface Session {
  code: string
  token: string
}

const NAME_KEY = 'ww.name'
const SESSION_KEY = 'ww.session'

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

export const loadName = () => get(NAME_KEY) ?? ''
export const saveName = (n: string) => set(NAME_KEY, n)

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(get(SESSION_KEY) ?? 'null')
    return s && s.code && s.token ? s : null
  } catch {
    return null
  }
}

export const saveSession = (s: Session | null) => set(SESSION_KEY, s ? JSON.stringify(s) : null)

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
