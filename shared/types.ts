// Shared between the web client (src) and the API server (api).
// Only types and pure constants live here.

export type Role = 'werewolf' | 'seer' | 'witch' | 'hunter' | 'idiot' | 'villager'

export const ROLE_ORDER: Role[] = ['werewolf', 'seer', 'witch', 'hunter', 'idiot', 'villager']

export const ROLE_NAME: Record<Role, string> = {
  werewolf: '狼人',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
  idiot: '白痴',
  villager: '平民',
}

export const GOD_ROLES: Role[] = ['seer', 'witch', 'hunter', 'idiot']

export interface RoomConfig {
  werewolf: number
  seer: number
  witch: number
  hunter: number
  idiot: number
  villager: number
  /** 女巫是否可以同一晚同时使用解药和毒药 */
  witchBothSameNight: boolean
  /** 女巫是否可以自救 */
  witchSelfSave: boolean
  /** 是否允许观战（上帝视角，只读） */
  allowSpectators: boolean
}

export const DEFAULT_CONFIG: RoomConfig = {
  werewolf: 2,
  seer: 1,
  witch: 1,
  hunter: 1,
  idiot: 0,
  villager: 2,
  witchBothSameNight: false,
  witchSelfSave: true,
  allowSpectators: false,
}

/** 每个房间最多的观战人数 */
export const MAX_SPECTATORS = 5

export const MAX_SEATS = 18

export function seatCount(c: RoomConfig) {
  return c.werewolf + c.seer + c.witch + c.hunter + (c.idiot ?? 0) + c.villager
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
  | 'idiot' // 白痴被投出，等待决定是否亮明身份
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

/** 频道里法官发言使用的座位号 */
export const JUDGE_CHAT_SEAT = -1
/** 观战频道里观战席发言使用的座位号 */
export const SPECTATOR_CHAT_SEAT = -2

export interface ChatMessage {
  /** 发言者座位号；法官为 JUDGE_CHAT_SEAT，观战席为 SPECTATOR_CHAT_SEAT */
  seat: number
  /** 发言者用户 id，用于判断是否为自己的发言 */
  uid?: string
  /** 发言时所处的阶段，例如「第1夜」「第2天」，用于分段显示 */
  label?: string
  name: string
  text: string
  ts: number
}

export interface WolfView {
  seats: number[]
  aliveSeats: number[]
  opened: number[]
  selections: Record<number, WolfChoice>
  /** 已点「确定」锁定选择的狼人座位 */
  locked: number[]
  /** 所有狼人都锁定且意见一致后，等待最终确认的猎杀对象 */
  pending: WolfChoice
  /** 第几轮选择（意见不统一或取消后加一） */
  round: number
  /** 上一轮作废的原因，例如意见不统一 */
  note: string | null
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
  draft: WitchDraft
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
  /** 猎人正在瞄准的玩家（未开枪前的实时选择） */
  draft: number | null
}

/** 女巫在面板上的实时选择（确定前），用于上帝视角镜像 */
export interface WitchDraft {
  save: boolean
  poison: boolean
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
  /** 自己的用户 id */
  myId: string
  mySeat: number | null
  myRole: Role | null
  meAlive: boolean
  /** 上帝视角观看（已出局的玩家或观战席）：可观看狼人、预言家、女巫的操作 */
  watching: boolean
  /** 第一天出局的玩家在第一天内暂不能观战，第二夜开始才进入上帝视角 */
  watchLocked: boolean
  /** 死亡玩家长按可查看的所有身份 */
  peekRoles: Role[] | null
  wolf: WolfView | null
  seer: SeerView | null
  witch: WitchView | null
  vote: VoteView | null
  hunter: HunterView | null
  /** 白痴被投出、等待决定（法官、观战者与白痴本人可见） */
  idiot: { seat: number } | null
  /** 已亮明身份的白痴：免于出局一次，此后不能投票也不能被投票 */
  idiotRevealed: number | null
  /** 是否已配置该角色 */
  hasSeer: boolean
  hasWitch: boolean
  seerDone: boolean
  witchDone: boolean
  announcements: Announcement[]
  judgeLog: string[] | null
  /** 观战频道（出局玩家、观战席、法官可见可发言），其他人为 null */
  ghostChat: ChatMessage[] | null
  winner: Winner | null
  lastNightDeaths: number[] | null
}

export interface RoomView {
  code: string
  config: RoomConfig
  judge: UserBrief
  seats: (UserBrief | null)[]
  swaps: SwapRequestView[]
  /** 观战席 */
  spectators: UserBrief[]
  /** 距离因空闲自动解散还剩多少毫秒（生成视图时） */
  idleRemainingMs: number
  /** 剩余时间低于该值时提醒所有人，可点击延长 */
  idleWarnMs: number
  /** 游戏进行中（未公布结果） */
  inGame: boolean
}

export interface StateView {
  me: { id: string; name: string; isJudge: boolean; isSpectator: boolean; seat: number | null }
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
  | { type: 'ghostChat'; text: string }
  /** 狼人锁定自己的选择 */
  | { type: 'wolfConfirm' }
  /** 狼人撤回自己的锁定；最终确认弹窗里点取消则全体重选 */
  | { type: 'wolfCancel' }
  /** 意见一致后最终确认猎杀 */
  | { type: 'wolfFinal' }
  | { type: 'seerSelect'; seat: number }
  | { type: 'seerConfirm' }
  | { type: 'witchAct'; save: boolean; poison: number | null }
  | { type: 'voteSelect'; choice: VoteChoice }
  | { type: 'voteConfirm' }
  | { type: 'hunterShoot'; target: number | null }
  | { type: 'hunterDraft'; target: number | null }
  | { type: 'witchDraft'; save: boolean; poison: boolean; target: number | null }
  | { type: 'idiotDecide'; reveal: boolean }
  | { type: 'ping' }
  /** 延长房间：重新开始空闲计时 */
  | { type: 'extend' }

export type ServerMessage =
  | { type: 'state'; state: StateView }
  | { type: 'error'; message: string }
  | { type: 'swapResult'; accepted: boolean; by: string }
  | { type: 'kicked'; reason: string }
  | { type: 'pong' }

// ---------- 对局回放 ----------

export type ReplayStatus = 'playing' | 'finished' | 'aborted'

/** 一局的基本信息 */
export interface ReplayGameInfo {
  id: string
  code: string
  /** 该房间的第几局 */
  round: number
  status: ReplayStatus
  winner: Winner | null
  startedAt: number
  endedAt: number | null
  /** 记录功能上线前的对局，只有最终局面 */
  backfilled: boolean
  /** 从数据库残留中恢复的对局 */
  recovered: boolean
}

/** 时间轴上的一个事件 */
export interface ReplayEvent {
  seq: number
  ts: number
  actor: string
  text: string
  phase: string
  day: number
}

/** 下载到本地的回放文件（.wwreplay，gzip 压缩的 JSON） */
export interface ReplayFile {
  format: 'werewolf-replay'
  version: 1
  exportedAt: number
  game: ReplayGameInfo
  /** 每个事件附带当时的上帝视角，离线即可回放 */
  events: (ReplayEvent & { view: StateView })[]
}
