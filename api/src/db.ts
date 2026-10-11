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

// ---------------- 对局记录（后台回放） ----------------

db.run(`CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  meta TEXT NOT NULL,
  status TEXT NOT NULL,
  winner TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
)`)
db.run(`CREATE TABLE IF NOT EXISTS game_events (
  game_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  actor TEXT NOT NULL,
  text TEXT NOT NULL,
  phase TEXT NOT NULL,
  day INTEGER NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (game_id, seq)
)`)

export type GameStatus = 'playing' | 'finished' | 'aborted'

export interface GameRow {
  id: string
  code: string
  meta: string
  status: GameStatus
  winner: string | null
  started_at: number
  ended_at: number | null
}

export interface EventRow {
  seq: number
  ts: number
  actor: string
  text: string
  phase: string
  day: number
}

const insertGame = db.prepare('INSERT OR IGNORE INTO games (id, code, meta, status, started_at) VALUES (?, ?, ?, ?, ?)')
const updateGame = db.prepare('UPDATE games SET status = ?, winner = ?, ended_at = ? WHERE id = ? AND status = ?')
const insertEvent = db.prepare('INSERT INTO game_events (game_id, seq, ts, actor, text, phase, day, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
const maxSeq = db.prepare('SELECT COALESCE(MAX(seq), -1) AS s FROM game_events WHERE game_id = ?')

export function createGameRecord(id: string, code: string, meta: unknown) {
  insertGame.run(id, code, JSON.stringify(meta), 'playing', Date.now())
}

export function finishGameRecord(id: string, status: Exclude<GameStatus, 'playing'>, winner: string | null) {
  updateGame.run(status, winner, Date.now(), id, 'playing')
}

export function addGameEvent(gameId: string, e: Omit<EventRow, 'seq'> & { state: unknown }) {
  const seq = (maxSeq.get(gameId) as { s: number }).s + 1
  insertEvent.run(gameId, seq, e.ts, e.actor, e.text, e.phase, e.day, JSON.stringify(e.state))
}

export function listGameRecords(limit = 200): (GameRow & { events: number })[] {
  return db
    .prepare('SELECT g.*, (SELECT COUNT(*) FROM game_events e WHERE e.game_id = g.id) AS events FROM games g ORDER BY started_at DESC LIMIT ?')
    .all(limit) as (GameRow & { events: number })[]
}

export function getGameRecord(id: string): GameRow | null {
  return (db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined) ?? null
}

export function getGameEvents(id: string): EventRow[] {
  return db.prepare('SELECT seq, ts, actor, text, phase, day FROM game_events WHERE game_id = ? ORDER BY seq').all(id) as EventRow[]
}

export function getGameEventState(id: string, seq: number): unknown | null {
  const row = db.prepare('SELECT state FROM game_events WHERE game_id = ? AND seq = ?').get(id, seq) as { state: string } | undefined
  return row ? JSON.parse(row.state) : null
}
