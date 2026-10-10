import { Database } from 'bun:sqlite'
import type { RoomData } from './room'

const db = new Database(process.env.DB_PATH ?? `${import.meta.dir}/../werewolf.sqlite`, { create: true })
db.run('PRAGMA journal_mode = WAL')
db.run(`CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`)

const upsert = db.prepare('INSERT INTO rooms (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
const del = db.prepare('DELETE FROM rooms WHERE code = ?')

export function saveRoom(d: RoomData) {
  upsert.run(d.code, JSON.stringify(d), Date.now())
}

export function deleteRoom(code: string) {
  del.run(code)
}

/** 加载最近 2 天内活跃的房间，清理更早的 */
export function loadRooms(): RoomData[] {
  const cutoff = Date.now() - 2 * 24 * 3600 * 1000
  db.prepare('DELETE FROM rooms WHERE updated_at < ?').run(cutoff)
  return (db.prepare('SELECT data FROM rooms').all() as { data: string }[]).map((r) => JSON.parse(r.data) as RoomData)
}
