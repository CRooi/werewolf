// Shared between the web client (src) and the API server (api).
// Only types and pure constants live here.

export type Role = 'werewolf' | 'seer' | 'witch' | 'hunter' | 'villager'

export const ROLE_ORDER: Role[] = ['werewolf', 'seer', 'witch', 'hunter', 'villager']

export const ROLE_NAME: Record<Role, string> = {
  werewolf: '狼人',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
  villager: '平民',
}

export const GOD_ROLES: Role[] = ['seer', 'witch', 'hunter']

export interface RoomConfig {
  werewolf: number
  seer: number
  witch: number
  hunter: number
  villager: number
  /** 女巫是否可以同一晚同时使用解药和毒药 */
  witchBothSameNight: boolean
  /** 女巫是否可以自救 */
  witchSelfSave: boolean
}

export const DEFAULT_CONFIG: RoomConfig = {
  werewolf: 2,
  seer: 1,
  witch: 1,
  hunter: 1,
  villager: 2,
  witchBothSameNight: false,
  witchSelfSave: false,
}

export const MAX_SEATS = 18

export function seatCount(c: RoomConfig) {
  return c.werewolf + c.seer + c.witch + c.hunter + c.villager
}

export type Phase =
  | 'dealt' // 发牌完成，等待天黑
  | 'night_start' // 天黑请闭眼
  | 'wolf_wake' // 狼人请睁眼
  | 'wolf_pick' // 狼人选择猎杀对象
  | 'night_menu' // 法官选择下一个夜间角色 / 天亮
  | 'seer_wake'
  | 'seer_pick'
  | 'seer_result'
  | 'witch_wake'
  | 'witch_act'
  | 'day' // 天亮公布死讯
  | 'hunter' // 猎人带人
  | 'voting'
  | 'vote_result'
  | 'game_over' // 法官可见胜负，等待公布
  | 'revealed' // 已公布结果

export type Winner = 'wolf' | 'good'

/** 狼人的选择：座位号(0-based) | 'none' 今晚不猎杀 | null 未选择 */
export type WolfChoice = number | 'none' | null
export type VoteChoice = number | 'abstain' | null

export interface UserBrief {
  id: string
  name: string
  online: boolean
}

export interface SwapRequestView {
  id: string
  from: UserBrief
  to: UserBrief
}

export interface PlayerView {
  seat: number // 0-based
  user: UserBrief
  /** 公开的存活状态 */
  alive: boolean
  /** 仅当本人可见此人身份时有值 */
  role?: Role
  /** 法官视角：今晚将死亡（尚未公布） */
  pendingDeath?: boolean
}

/** 狼人频道里法官发言使用的座位号 */
export const JUDGE_CHAT_SEAT = -1

export interface ChatMessage {
  /** 发言者座位号；法官为 JUDGE_CHAT_SEAT */
  seat: number
  name: string
  text: string
  ts: number
}

export interface WolfView {
  seats: number[]
  aliveSeats: number[]
  opened: number[]
  selections: Record<number, WolfChoice>
  confirmed: boolean
  target: WolfChoice
  chat: ChatMessage[]
}

export interface SeerView {
  seat: number
  alive: boolean
  opened: boolean
  selection: number | null
  confirmed: boolean
  /** 本晚查验结果（法官点“验明身份”后才有） */
  result: 'good' | 'bad' | null
  history: { day: number; seat: number; result: 'good' | 'bad' }[]
}

export interface WitchView {
  seat: number
  alive: boolean
  opened: boolean
  informed: boolean
  antidote: boolean
  poison: boolean
  /** 今晚被刀的玩家：仅在告知死亡信息后且解药未用时对女巫可见；法官总能看到 */
  victim: number | null
  /** 女巫是否能看到今晚死亡信息 */
  canSeeVictim: boolean
  acted: boolean
  saved: boolean
  poisoned: number | null
  bothSameNight: boolean
  selfSave: boolean
}

export interface Ballot {
  choice: VoteChoice
  confirmed: boolean
}

export interface VoteView {
  round: number
  /** PK 轮的候选人；null 表示所有存活玩家 */
  candidates: number[] | null
  voters: number[]
  ballots: Record<number, Ballot>
  result: VoteResult | null
}

export interface VoteResult {
  tally: Record<number, number>
  abstain: number
  tie: number[] | null
  eliminated: number | null
  resolved: boolean
  note: string
}

export interface HunterView {
  seat: number
  context: 'night' | 'vote'
  done: boolean
  target: number | null
}

export interface Announcement {
  day: number
  kind: 'night' | 'vote' | 'hunter' | 'info'
  text: string
  seats: number[]
}

export interface GameView {
  id: string
  phase: Phase
  day: number
  players: PlayerView[]
  mySeat: number | null
  myRole: Role | null
  meAlive: boolean
  /** 已出局的玩家：可观看狼人、预言家、女巫的操作 */
  watching: boolean
  /** 死亡玩家长按可查看的所有身份 */
  peekRoles: Role[] | null
  wolf: WolfView | null
  seer: SeerView | null
  witch: WitchView | null
  vote: VoteView | null
  hunter: HunterView | null
  /** 是否已配置该角色 */
  hasSeer: boolean
  hasWitch: boolean
  seerDone: boolean
  witchDone: boolean
  announcements: Announcement[]
  judgeLog: string[] | null
  winner: Winner | null
  lastNightDeaths: number[] | null
}

export interface RoomView {
  code: string
  config: RoomConfig
  judge: UserBrief
  seats: (UserBrief | null)[]
  swaps: SwapRequestView[]
  /** 游戏进行中（未公布结果） */
  inGame: boolean
}

export interface StateView {
  me: { id: string; name: string; isJudge: boolean; seat: number | null }
  room: RoomView
  game: GameView | null
}

// ---------- WebSocket protocol ----------

export type JudgeStep =
  | 'nightStart'
  | 'wolfWake'
  | 'wolfPick'
  | 'wolfClose'
  | 'seerWake'
  | 'seerPick'
  | 'seerReveal'
  | 'seerClose'
  | 'witchWake'
  | 'witchInform'
  | 'witchClose'
  | 'dawn'
  | 'voteStart'
  | 'tieRevote'
  | 'tieNone'
  | 'reveal'

export type ClientMessage =
  | { type: 'sit'; seat: number }
  | { type: 'swapRequest'; to: string }
  | { type: 'swapRespond'; id: string; accept: boolean }
  | { type: 'swapCancel'; id: string }
  | { type: 'kick'; userId: string }
  | { type: 'leave' }
  | { type: 'disband' }
  | { type: 'updateConfig'; config: RoomConfig }
  | { type: 'start' }
  | { type: 'abort' }
  | { type: 'judge'; step: JudgeStep }
  | { type: 'tieChoose'; seat: number }
  | { type: 'openEyes' }
  | { type: 'wolfSelect'; choice: WolfChoice }
  | { type: 'wolfChat'; text: string }
  | { type: 'wolfConfirm' }
  | { type: 'seerSelect'; seat: number }
  | { type: 'seerConfirm' }
  | { type: 'witchAct'; save: boolean; poison: number | null }
  | { type: 'voteSelect'; choice: VoteChoice }
  | { type: 'voteConfirm' }
  | { type: 'hunterShoot'; target: number | null }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'state'; state: StateView }
  | { type: 'error'; message: string }
  | { type: 'swapResult'; accepted: boolean; by: string }
  | { type: 'kicked'; reason: string }
  | { type: 'pong' }
