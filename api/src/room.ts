import {
  GOD_ROLES,
  JUDGE_CHAT_SEAT,
  SPECTATOR_CHAT_SEAT,
  MAX_SPECTATORS,
  MAX_SEATS,
  ROLE_NAME,
  ROLE_ORDER,
  seatCount,
  type Announcement,
  type Ballot,
  type ChatMessage,
  type ClientMessage,
  type GameView,
  type JudgeStep,
  type Phase,
  type PlayerView,
  type Role,
  type RoomConfig,
  type StateView,
  type VoteChoice,
  type VoteResult,
  type Winner,
  type WolfChoice,
} from '../../shared/types'

export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg)
}

export interface User {
  id: string
  token: string
  name: string
}

export interface SwapRequest {
  id: string
  from: string
  to: string
}

interface NightState {
  wolfOpened: number[]
  wolfSel: Record<number, WolfChoice>
  wolfConfirmed: boolean
  wolfTarget: WolfChoice
  seerDone: boolean
  seerOpened: boolean
  seerSel: number | null
  seerConfirmed: boolean
  seerResult: 'good' | 'bad' | null
  witchDone: boolean
  witchOpened: boolean
  witchInformed: boolean
  witchActed: boolean
  saved: boolean
  poisoned: number | null
}

interface VoteState {
  round: number
  candidates: number[] | null
  voters: number[]
  ballots: Record<number, Ballot>
  result: VoteResult | null
}

interface HunterState {
  seat: number
  context: 'night' | 'vote'
  done: boolean
  target: number | null
}

export interface GameState {
  id: string
  phase: Phase
  day: number
  seats: string[]
  roles: Role[]
  alive: boolean[]
  antidote: boolean
  poison: boolean
  night: NightState
  seerHistory: { day: number; seat: number; result: 'good' | 'bad' }[]
  vote: VoteState | null
  hunter: HunterState | null
  /** 白痴被投出，等待决定是否亮明身份 */
  idiot: { seat: number } | null
  idiotRevealed: number | null
  /** 猎人是否已经开过枪（只能开一次） */
  hunterUsed: boolean
  announcements: Announcement[]
  judgeLog: string[]
  /** 狼人频道：整局保留 */
  wolfChat: ChatMessage[]
  /** 观战频道：出局玩家、观战席与法官，整局保留 */
  ghostChat: ChatMessage[]
  winner: Winner | null
  lastNightDeaths: number[] | null
}

export interface RoomData {
  code: string
  createdAt: number
  config: RoomConfig
  judgeId: string
  users: Record<string, User>
  seats: (string | null)[]
  /** 观战席的用户 id */
  spectators: string[]
  swaps: SwapRequest[]
  game: GameState | null
}

const SPECTATOR_ID = '__spectator__'

const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

function freshNight(): NightState {
  return {
    wolfOpened: [],
    wolfSel: {},
    wolfConfirmed: false,
    wolfTarget: null,
    seerDone: false,
    seerOpened: false,
    seerSel: null,
    seerConfirmed: false,
    seerResult: null,
    witchDone: false,
    witchOpened: false,
    witchInformed: false,
    witchActed: false,
    saved: false,
    poisoned: null,
  }
}

export function validateConfig(c: RoomConfig): RoomConfig {
  const clean: RoomConfig = {
    werewolf: Math.floor(Number(c.werewolf) || 0),
    seer: Math.floor(Number(c.seer) || 0),
    witch: Math.floor(Number(c.witch) || 0),
    hunter: Math.floor(Number(c.hunter) || 0),
    idiot: Math.floor(Number(c.idiot) || 0),
    villager: Math.floor(Number(c.villager) || 0),
    witchBothSameNight: !!c.witchBothSameNight,
    witchSelfSave: !!c.witchSelfSave,
    allowSpectators: !!c.allowSpectators,
  }
  for (const r of ROLE_ORDER) if (clean[r] < 0) fail('角色数量不能为负数')
  if (clean.seer > 1 || clean.witch > 1 || clean.hunter > 1 || clean.idiot > 1) fail('预言家、女巫、猎人、白痴最多各 1 名')
  if (clean.werewolf < 1) fail('至少需要 1 名狼人')
  const n = seatCount(clean)
  if (n - clean.werewolf < 1) fail('至少需要 1 名好人')
  if (n < 3) fail('至少需要 3 名玩家')
  if (n > MAX_SEATS) fail(`最多 ${MAX_SEATS} 名玩家`)
  return clean
}

export function genCode(exists: (c: string) => boolean): string {
  for (;;) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    if (!exists(code)) return code
  }
}

export function cleanName(name: unknown): string {
  const n = String(name ?? '').trim().slice(0, 12)
  if (!n) fail('请先给自己取个名字')
  return n
}

export class Room {
  constructor(public d: RoomData) {
    // 兼容旧数据
    d.spectators ??= []
    d.config.allowSpectators ??= false
    d.config.idiot ??= 0
    if (d.game) {
      d.game.ghostChat ??= []
      d.game.wolfChat ??= []
      d.game.idiot ??= null
      d.game.idiotRevealed ??= null
    }
  }

  static create(code: string, config: RoomConfig, judgeName: string): { room: Room; user: User } {
    const cfg = validateConfig(config)
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(judgeName) }
    const room = new Room({
      code,
      createdAt: Date.now(),
      config: cfg,
      judgeId: user.id,
      users: { [user.id]: user },
      seats: Array(seatCount(cfg)).fill(null),
      spectators: [],
      swaps: [],
      game: null,
    })
    return { room, user }
  }

  get inGame() {
    return !!this.d.game && this.d.game.phase !== 'revealed'
  }

  userByToken(token: string) {
    return Object.values(this.d.users).find((u) => u.token === token)
  }

  seatOf(userId: string) {
    const i = this.d.seats.indexOf(userId)
    return i < 0 ? null : i
  }

  join(name: string): User {
    if (this.inGame) fail('游戏进行中，无法加入')
    const free = this.d.seats.indexOf(null)
    if (free < 0) fail('房间已满')
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(name) }
    this.d.users[user.id] = user
    this.d.seats[free] = user.id
    return user
  }

  /** 以观战身份加入：上帝视角，只能看不能操作；开局前和游戏中均可加入 */
  spectate(name: string): User {
    if (!this.d.config.allowSpectators) fail('本房间不允许观战')
    if (this.d.spectators.length >= MAX_SPECTATORS) fail(`观战席已满（最多 ${MAX_SPECTATORS} 人）`)
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(name) }
    this.d.users[user.id] = user
    this.d.spectators.push(user.id)
    return user
  }

  isSpectator(userId: string) {
    return this.d.spectators.includes(userId)
  }

  private removeUser(userId: string) {
    const s = this.seatOf(userId)
    if (s !== null) this.d.seats[s] = null
    this.d.spectators = this.d.spectators.filter((x) => x !== userId)
    delete this.d.users[userId]
    this.d.swaps = this.d.swaps.filter((x) => x.from !== userId && x.to !== userId)
  }

  /** returns side-effects the transport layer should perform */
  handle(userId: string, msg: ClientMessage): { kicked?: string; disband?: boolean; swapResult?: { to: string; accepted: boolean; by: string } } {
    const isJudge = userId === this.d.judgeId
    const needJudge = () => {
      if (!isJudge) fail('只有法官可以操作')
    }
    const needLobby = () => {
      if (this.inGame) fail('游戏进行中')
    }

    // 观战频道：出局玩家、观战席与法官可发言
    if (msg.type === 'ghostChat') {
      const g = this.d.game
      if (!g || g.phase === 'revealed') fail('游戏未开始')
      const seat = g!.seats.indexOf(userId)
      const spectator = this.isSpectator(userId)
      if (!isJudge && !spectator && !(seat >= 0 && !g!.alive[seat])) fail('只有出局玩家、观战者和法官可以在观战频道发言')
      const text = String(msg.text ?? '').trim().slice(0, 200)
      if (!text) return {}
      g!.ghostChat.push({
        seat: isJudge ? JUDGE_CHAT_SEAT : spectator ? SPECTATOR_CHAT_SEAT : seat,
        uid: userId,
        label: this.phaseLabel(),
        name: this.d.users[userId]!.name,
        text,
        ts: Date.now(),
      })
      return {}
    }

    // 观战者只能看，唯一允许的操作是退出观战（以及上面的观战频道）
    if (this.isSpectator(userId)) {
      if (msg.type === 'ping') return {}
      if (msg.type !== 'leave') fail('观战中只能观看，不能操作')
      this.removeUser(userId)
      return { kicked: userId }
    }

    switch (msg.type) {
      case 'ping':
        return {}
      case 'sit': {
        needLobby()
        if (isJudge) fail('法官请通过交换位置入座')
        const seat = msg.seat
        if (!(seat >= 0 && seat < this.d.seats.length)) fail('座位不存在')
        if (this.d.seats[seat]) fail('该座位已有人')
        const cur = this.seatOf(userId)
        if (cur !== null) this.d.seats[cur] = null
        this.d.seats[seat] = userId
        return {}
      }
      case 'swapRequest': {
        needLobby()
        const to = this.d.users[msg.to]
        if (!to || to.id === userId || this.isSpectator(msg.to)) fail('玩家不存在')
        if (this.d.swaps.some((s) => s.from === userId && s.to === msg.to)) return {}
        this.d.swaps = this.d.swaps.filter((s) => s.from !== userId)
        this.d.swaps.push({ id: uid(), from: userId, to: msg.to })
        return {}
      }
      case 'swapCancel': {
        this.d.swaps = this.d.swaps.filter((s) => !(s.id === msg.id && s.from === userId))
        return {}
      }
      case 'swapRespond': {
        const req = this.d.swaps.find((s) => s.id === msg.id && s.to === userId)
        if (!req) fail('交换请求已失效')
        this.d.swaps = this.d.swaps.filter((s) => s.id !== msg.id)
        if (!msg.accept) return { swapResult: { to: req!.from, accepted: false, by: this.d.users[userId]!.name } }
        needLobby()
        this.swap(req!.from, req!.to)
        this.d.swaps = this.d.swaps.filter((s) => s.from !== req!.from && s.to !== req!.from && s.from !== req!.to && s.to !== req!.to)
        return { swapResult: { to: req!.from, accepted: true, by: this.d.users[userId]!.name } }
      }
      case 'kick': {
        needJudge()
        // 观战者随时可以请出；玩家只能在开局前请出
        if (!this.isSpectator(msg.userId)) needLobby()
        if (msg.userId === userId || !this.d.users[msg.userId]) fail('玩家不存在')
        this.removeUser(msg.userId)
        return { kicked: msg.userId }
      }
      case 'leave': {
        needLobby()
        if (isJudge) fail('法官不能离开，可以解散房间或与玩家交换位置')
        this.removeUser(userId)
        return { kicked: userId }
      }
      case 'disband': {
        needJudge()
        return { disband: true }
      }
      case 'updateConfig': {
        needJudge()
        needLobby()
        const cfg = validateConfig(msg.config)
        const n = seatCount(cfg)
        const seated = this.d.seats.filter(Boolean) as string[]
        if (seated.length > n) fail(`当前已有 ${seated.length} 名玩家入座，座位数不能少于玩家数`)
        const next: (string | null)[] = Array(n).fill(null)
        const overflow: string[] = []
        this.d.seats.forEach((u, i) => {
          if (!u) return
          if (i < n) next[i] = u
          else overflow.push(u)
        })
        for (const u of overflow) next[next.indexOf(null)] = u
        this.d.seats = next
        this.d.config = cfg
        return {}
      }
      case 'start': {
        needJudge()
        needLobby()
        if (this.d.seats.some((s) => !s)) fail('人还没满')
        this.startGame()
        return {}
      }
      case 'abort': {
        needJudge()
        if (!this.inGame) fail('当前没有进行中的对局')
        this.d.game = null
        return {}
      }
      default:
        this.gameAction(userId, isJudge, msg)
        return {}
    }
  }

  private swap(a: string, b: string) {
    const d = this.d
    const sa = this.seatOf(a)
    const sb = this.seatOf(b)
    if (a === d.judgeId || b === d.judgeId) {
      const player = a === d.judgeId ? b : a
      const ps = this.seatOf(player)
      if (ps === null) fail('对方不在座位上')
      d.seats[ps!] = d.judgeId
      d.judgeId = player
      return
    }
    if (sa === null || sb === null) fail('对方不在座位上')
    d.seats[sa!] = b
    d.seats[sb!] = a
  }

  private startGame() {
    const c = this.d.config
    const roles: Role[] = []
    for (const r of ROLE_ORDER) for (let i = 0; i < c[r]; i++) roles.push(r)
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[roles[i], roles[j]] = [roles[j]!, roles[i]!]
    }
    this.d.swaps = []
    this.d.game = {
      id: uid(),
      phase: 'dealt',
      day: 1,
      seats: this.d.seats.slice() as string[],
      roles,
      alive: roles.map(() => true),
      antidote: c.witch > 0,
      poison: c.witch > 0,
      night: freshNight(),
      seerHistory: [],
      vote: null,
      hunter: null,
      idiot: null,
      idiotRevealed: null,
      hunterUsed: false,
      announcements: [],
      judgeLog: ['发牌完成'],
      wolfChat: [],
      ghostChat: [],
      winner: null,
      lastNightDeaths: null,
    }
  }

  // ---------------- game ----------------

  private g(): GameState {
    if (!this.d.game || this.d.game.phase === 'revealed') fail('游戏未开始')
    return this.d.game!
  }

  private roleSeat(role: Role) {
    return this.g().roles.indexOf(role)
  }

  private aliveWolves() {
    const g = this.g()
    return g.roles.map((r, i) => i).filter((i) => g.roles[i] === 'werewolf' && g.alive[i])
  }

  private label(seat: number) {
    const g = this.g()
    return `${seat + 1}号(${this.d.users[g.seats[seat]!]?.name ?? '?'})`
  }

  private log(text: string) {
    this.g().judgeLog.push(`第${this.g().day}${this.isNightPhase() ? '晚' : '天'}：${text}`)
  }

  /** 聊天消息的阶段标签 */
  private phaseLabel() {
    const g = this.g()
    return g.phase === 'dealt' ? '开局' : `第${g.day}${this.isNightPhase() ? '夜' : '天'}`
  }

  private isNightPhase() {
    return ['night_start', 'wolf_wake', 'wolf_pick', 'night_menu', 'seer_wake', 'seer_pick', 'seer_result', 'witch_wake', 'witch_act'].includes(this.g().phase)
  }

  private expect(...phases: Phase[]) {
    if (!phases.includes(this.g().phase)) fail('当前阶段无法进行此操作')
  }

  private gameAction(userId: string, isJudge: boolean, msg: ClientMessage) {
    const g = this.g()
    const mySeat = g.seats.indexOf(userId)
    const myRole = mySeat >= 0 ? g.roles[mySeat]! : null
    const meAlive = mySeat >= 0 && g.alive[mySeat]!

    switch (msg.type) {
      case 'judge':
        if (!isJudge) fail('只有法官可以操作')
        return this.judgeStep(msg.step)
      case 'tieChoose': {
        if (!isJudge) fail('只有法官可以操作')
        this.expect('vote_result')
        const r = g.vote?.result
        if (!r || r.resolved || !r.tie) fail('当前没有平票')
        if (!r!.tie!.includes(msg.seat)) fail('只能在平票玩家中指定')
        r!.note = `法官指定 ${msg.seat + 1}号 出局`
        this.eliminateByVote(msg.seat)
        return
      }
      case 'openEyes': {
        if (!meAlive) fail('你已出局')
        if (g.phase === 'wolf_wake' && myRole === 'werewolf') {
          if (!g.night.wolfOpened.includes(mySeat)) g.night.wolfOpened.push(mySeat)
          return
        }
        if (g.phase === 'seer_wake' && myRole === 'seer') {
          g.night.seerOpened = true
          return
        }
        if (g.phase === 'witch_wake' && myRole === 'witch') {
          g.night.witchOpened = true
          return
        }
        return fail('现在还不能睁眼')
      }
      case 'wolfSelect': {
        this.expect('wolf_pick')
        if (myRole !== 'werewolf' || !meAlive) fail('你不能参与猎杀')
        if (g.night.wolfConfirmed) fail('已经确认')
        const c = msg.choice
        if (c !== null && c !== 'none' && !(typeof c === 'number' && g.alive[c])) fail('只能选择存活玩家')
        g.night.wolfSel[mySeat] = c
        return
      }
      case 'wolfChat': {
        // 存活的狼人和法官可以在狼人频道发言，且只能在夜间
        if (!isJudge && (myRole !== 'werewolf' || !meAlive)) fail('你不能发言')
        if (!this.isNightPhase()) fail('狼人频道只能在夜晚发言')
        const text = String(msg.text ?? '').trim().slice(0, 200)
        if (!text) return
        g.wolfChat.push({ seat: isJudge ? JUDGE_CHAT_SEAT : mySeat, uid: userId, label: this.phaseLabel(), name: this.d.users[userId]!.name, text, ts: Date.now() })
        return
      }
      case 'wolfConfirm': {
        this.expect('wolf_pick')
        if (myRole !== 'werewolf' || !meAlive) fail('你不能参与猎杀')
        if (g.night.wolfConfirmed) return
        const sels = this.aliveWolves().map((s) => g.night.wolfSel[s] ?? null)
        const first = sels[0]
        if (first === null || first === undefined || sels.some((s) => s !== first)) fail('请统一意见。')
        g.night.wolfConfirmed = true
        g.night.wolfTarget = first!
        this.log(first === 'none' ? '狼人选择今晚不猎杀' : `狼人猎杀 ${this.label(first as number)}`)
        return
      }
      case 'seerSelect': {
        this.expect('seer_pick')
        if (myRole !== 'seer' || !meAlive) fail('你不是预言家')
        if (g.night.seerConfirmed) fail('已经确认')
        if (!(msg.seat >= 0 && msg.seat < g.seats.length) || msg.seat === mySeat) fail('不能查验该玩家')
        if (!g.alive[msg.seat]) fail('只能查验存活玩家')
        g.night.seerSel = msg.seat
        return
      }
      case 'seerConfirm': {
        this.expect('seer_pick')
        if (myRole !== 'seer' || !meAlive) fail('你不是预言家')
        if (g.night.seerSel === null) fail('请先选择玩家')
        g.night.seerConfirmed = true
        this.log(`预言家查验 ${this.label(g.night.seerSel!)}`)
        return
      }
      case 'witchAct': {
        this.expect('witch_act')
        if (myRole !== 'witch' || !meAlive) fail('你不是女巫')
        const n = g.night
        if (n.witchActed) fail('今晚已经行动过')
        const victim = typeof n.wolfTarget === 'number' ? n.wolfTarget : null
        if (msg.save) {
          if (!g.antidote) fail('解药已经用完')
          if (victim === null) fail('今晚没有人被猎杀')
          if (victim === mySeat && !this.d.config.witchSelfSave) fail('女巫不能自救')
        }
        if (msg.poison !== null) {
          if (!g.poison) fail('毒药已经用完')
          if (!(msg.poison >= 0 && msg.poison < g.seats.length) || !g.alive[msg.poison]) fail('只能毒存活的玩家')
        }
        if (msg.save && msg.poison !== null && !this.d.config.witchBothSameNight) fail('同一晚只能使用一瓶药')
        n.witchActed = true
        if (msg.save) {
          g.antidote = false
          n.saved = true
          this.log(`女巫使用解药救了 ${this.label(victim!)}`)
        }
        if (msg.poison !== null) {
          g.poison = false
          n.poisoned = msg.poison
          this.log(`女巫毒杀 ${this.label(msg.poison)}`)
        }
        if (!msg.save && msg.poison === null) this.log('女巫没有用药')
        return
      }
      case 'voteSelect': {
        this.expect('voting')
        const v = g.vote!
        if (!v.voters.includes(mySeat)) fail('你没有投票权')
        if (v.ballots[mySeat]?.confirmed) fail('已经确认投票')
        const c = msg.choice
        if (c !== null && c !== 'abstain') {
          if (!(typeof c === 'number' && g.alive[c])) fail('只能投给存活玩家')
          if (v.candidates && !v.candidates.includes(c)) fail('只能投给 PK 玩家')
          if (c === g.idiotRevealed) fail('已亮明身份的白痴不能被投票')
        }
        v.ballots[mySeat] = { choice: c, confirmed: false }
        return
      }
      case 'voteConfirm': {
        this.expect('voting')
        const v = g.vote!
        const b = v.ballots[mySeat]
        if (!v.voters.includes(mySeat)) fail('你没有投票权')
        if (!b || b.choice === null) fail('请先选择')
        b!.confirmed = true
        if (v.voters.every((s) => v.ballots[s]?.confirmed)) this.tallyVote()
        return
      }
      case 'idiotDecide': {
        this.expect('idiot')
        if (!g.idiot || g.idiot.seat !== mySeat) fail('你不是待决定的白痴')
        this.idiotDecide(!!msg.reveal)
        return
      }
      case 'hunterShoot': {
        this.expect('hunter')
        const h = g.hunter!
        if (mySeat !== h.seat) fail('你不是猎人')
        if (h.done) return
        if (msg.target !== null) {
          if (!g.alive[msg.target] || msg.target === mySeat) fail('只能带走存活玩家')
        }
        h.done = true
        h.target = msg.target
        g.hunterUsed = true
        if (msg.target === null) {
          this.log('猎人选择不带人')
          this.announce('hunter', '猎人选择不带人', [])
        } else {
          g.alive[msg.target] = false
          this.log(`猎人带走了 ${this.label(msg.target)}`)
          this.announce('hunter', `${this.label(h.seat)} 是猎人，开枪带走了 ${this.label(msg.target)}`, [msg.target])
        }
        if (this.checkWin()) return
        if (h.context === 'night') g.phase = 'day'
        else g.phase = 'vote_result'
        return
      }
      default:
        fail('未知操作')
    }
  }

  private announce(kind: Announcement['kind'], text: string, seats: number[]) {
    const g = this.g()
    g.announcements.push({ day: g.day, kind, text, seats })
  }

  private judgeStep(step: JudgeStep) {
    const g = this.g()
    const n = g.night
    switch (step) {
      case 'nightStart': {
        this.expect('dealt', 'vote_result')
        if (g.phase === 'vote_result' && !g.vote?.result?.resolved) fail('请先处理投票结果')
        if (g.phase === 'vote_result') g.day += 1
        g.night = freshNight()
        g.vote = null
        g.hunter = null
        g.phase = 'night_start'
        this.log('天黑请闭眼')
        return
      }
      case 'wolfWake':
        this.expect('night_start')
        g.phase = 'wolf_wake'
        return
      case 'wolfPick':
        this.expect('wolf_wake')
        if (this.aliveWolves().some((s) => !n.wolfOpened.includes(s))) fail('还有狼人没有睁眼')
        g.phase = 'wolf_pick'
        return
      case 'wolfClose':
        this.expect('wolf_pick')
        if (!n.wolfConfirmed) fail('狼人还没有确认猎杀对象')
        g.phase = 'night_menu'
        return
      case 'seerWake':
        this.expect('night_menu')
        if (!this.d.config.seer || n.seerDone) fail('预言家环节已结束')
        g.phase = 'seer_wake'
        return
      // 预言家 / 女巫已出局时，法官仍完整走一遍流程（不等待玩家操作），让场上玩家无法从节奏上察觉
      case 'seerPick': {
        this.expect('seer_wake')
        const alive = g.alive[this.roleSeat('seer')]
        if (alive && !n.seerOpened) fail('预言家还没有睁眼')
        g.phase = 'seer_pick'
        return
      }
      case 'seerReveal': {
        this.expect('seer_pick')
        if (g.alive[this.roleSeat('seer')]) {
          const target = n.seerSel
          if (!n.seerConfirmed || target === null) return fail('预言家还没有确认')
          n.seerResult = g.roles[target] === 'werewolf' ? 'bad' : 'good'
          g.seerHistory.push({ day: g.day, seat: target, result: n.seerResult })
        }
        g.phase = 'seer_result'
        return
      }
      case 'seerClose': {
        this.expect('seer_result')
        n.seerDone = true
        g.phase = 'night_menu'
        return
      }
      case 'witchWake':
        this.expect('night_menu')
        if (!this.d.config.witch || n.witchDone) fail('女巫环节已结束')
        g.phase = 'witch_wake'
        return
      case 'witchInform': {
        this.expect('witch_wake')
        const alive = g.alive[this.roleSeat('witch')]
        if (alive && !n.witchOpened) fail('女巫还没有睁眼')
        n.witchInformed = true
        g.phase = 'witch_act'
        return
      }
      case 'witchClose': {
        this.expect('witch_act')
        if (g.alive[this.roleSeat('witch')] && !n.witchActed) fail('女巫还没有行动')
        n.witchDone = true
        g.phase = 'night_menu'
        return
      }
      case 'dawn': {
        this.expect('night_menu')
        if (this.d.config.seer && !n.seerDone) fail('预言家环节还未进行')
        if (this.d.config.witch && !n.witchDone) fail('女巫环节还未进行')
        this.dawn()
        return
      }
      case 'voteStart': {
        this.expect('day')
        this.openVote(1, null)
        return
      }
      case 'tieRevote': {
        this.expect('vote_result')
        const r = g.vote?.result
        if (!r?.tie || r.resolved) fail('当前没有平票')
        this.openVote(g.vote!.round + 1, r!.tie!)
        return
      }
      case 'tieNone': {
        this.expect('vote_result')
        const r = g.vote?.result
        if (!r || r.resolved) fail('当前没有待处理的投票')
        r!.resolved = true
        r!.note = '无人出局'
        this.announce('vote', '投票结果：无人出局', [])
        this.log('投票无人出局')
        return
      }
      case 'reveal': {
        this.expect('game_over')
        g.phase = 'revealed'
        return
      }
    }
  }

  private nightDeaths(): number[] {
    const g = this.g()
    const n = g.night
    const deaths = new Set<number>()
    if (typeof n.wolfTarget === 'number' && !n.saved) deaths.add(n.wolfTarget)
    if (n.poisoned !== null) deaths.add(n.poisoned)
    return [...deaths].sort((a, b) => a - b)
  }

  private dawn() {
    const g = this.g()
    const n = g.night
    const deaths = this.nightDeaths()
    for (const s of deaths) g.alive[s] = false
    g.lastNightDeaths = deaths
    g.phase = 'day'
    this.announce(
      'night',
      deaths.length ? `昨晚 ${deaths.map((s) => this.label(s)).join('、')} 死亡` : '昨晚是平安夜',
      deaths,
    )
    g.judgeLog.push(`第${g.day}天：天亮了，${deaths.length ? deaths.map((s) => this.label(s)).join('、') + ' 死亡' : '平安夜'}`)
    if (this.checkWin()) return
    const hunterSeat = g.roles.indexOf('hunter')
    if (
      hunterSeat >= 0 &&
      !g.hunterUsed &&
      deaths.includes(hunterSeat) &&
      n.wolfTarget === hunterSeat &&
      n.poisoned !== hunterSeat
    ) {
      g.hunter = { seat: hunterSeat, context: 'night', done: false, target: null }
      g.phase = 'hunter'
    }
  }

  private openVote(round: number, candidates: number[] | null) {
    const g = this.g()
    // 已翻牌的白痴不能投票
    const voters = g.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0 && !(candidates ?? []).includes(i) && i !== g.idiotRevealed)
    if (!voters.length) fail('没有可以投票的玩家')
    g.vote = { round, candidates, voters, ballots: {}, result: null }
    g.phase = 'voting'
  }

  private tallyVote() {
    const g = this.g()
    const v = g.vote!
    const tally: Record<number, number> = {}
    let abstain = 0
    for (const s of v.voters) {
      const c = v.ballots[s]!.choice as VoteChoice
      if (c === 'abstain' || c === null) abstain++
      else tally[c] = (tally[c] ?? 0) + 1
    }
    const max = Math.max(0, ...Object.values(tally))
    const top = Object.keys(tally).map(Number).filter((s) => tally[s] === max)
    v.result = { tally, abstain, tie: null, eliminated: null, resolved: false, note: '' }
    g.phase = 'vote_result'
    const detail = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `${Number(s) + 1}号 ${c}票`)
      .join('，')
    this.log(`第${v.round}轮投票：${detail || '全部弃票'}${abstain ? `，弃票 ${abstain}` : ''}`)
    if (max === 0) {
      v.result.resolved = true
      v.result.note = '全部弃票，无人出局'
      this.announce('vote', '投票结果：全部弃票，无人出局', [])
      return
    }
    if (top.length > 1) {
      v.result.tie = top.sort((a, b) => a - b)
      v.result.note = `${v.result.tie.map((s) => `${s + 1}号`).join('、')} 平票，等待法官处理`
      return
    }
    v.result.note = `${top[0]! + 1}号 得票最多，出局`
    this.eliminateByVote(top[0]!)
  }

  private eliminateByVote(seat: number) {
    const g = this.g()
    // 未翻牌的白痴被投出：先由白痴决定是否亮明身份（对外不透露原因）
    if (g.roles[seat] === 'idiot' && g.idiotRevealed === null) {
      g.idiot = { seat }
      g.vote!.result!.note = `${seat + 1}号 得票最多，等待法官处理`
      g.phase = 'idiot'
      this.log(`${this.label(seat)}（白痴）被投出，等待决定是否亮明身份`)
      return
    }
    this.exileByVote(seat)
  }

  /** 白痴决定：亮明身份免于出局（此后不能投票也不能被投票），否则照常出局 */
  private idiotDecide(reveal: boolean) {
    const g = this.g()
    const seat = g.idiot!.seat
    g.idiot = null
    g.phase = 'vote_result'
    if (!reveal) return this.exileByVote(seat)
    const r = g.vote!.result!
    g.idiotRevealed = seat
    r.resolved = true
    r.eliminated = null
    r.note = `${seat + 1}号 亮明白痴身份，免于出局`
    this.announce('vote', `投票结果：${this.label(seat)} 亮明身份是白痴，免于放逐，此后不能投票也不能被投票`, [])
    this.log(`${this.label(seat)} 亮明白痴身份，免于出局`)
  }

  private exileByVote(seat: number) {
    const g = this.g()
    const r = g.vote!.result!
    r.eliminated = seat
    r.resolved = true
    g.alive[seat] = false
    this.announce('vote', `投票结果：${this.label(seat)} 被放逐出局`, [seat])
    this.log(`${this.label(seat)} 被投票出局`)
    if (this.checkWin()) return
    if (g.roles[seat] === 'hunter' && !g.hunterUsed) {
      g.hunter = { seat, context: 'vote', done: false, target: null }
      g.phase = 'hunter'
    }
  }

  /** 屠边规则；同时满足时狼人胜 */
  private checkWin(): boolean {
    const g = this.g()
    const c = this.d.config
    const alive = (pred: (r: Role) => boolean) => g.roles.some((r, i) => pred(r) && g.alive[i])
    const godsConfigured = GOD_ROLES.some((r) => c[r] > 0)
    let winner: Winner | null = null
    if ((godsConfigured && !alive((r) => GOD_ROLES.includes(r))) || (c.villager > 0 && !alive((r) => r === 'villager'))) winner = 'wolf'
    else if (!alive((r) => r === 'werewolf')) winner = 'good'
    if (!winner) return false
    g.winner = winner
    g.phase = 'game_over'
    g.hunter = null
    g.judgeLog.push(`游戏结束：${winner === 'wolf' ? '狼人' : '好人'}胜利`)
    return true
  }

  // ---------------- views ----------------

  /** 大屏观战视角：以“非房间成员”的身份投影，只包含所有人可见的信息 */
  spectatorView(online: (id: string) => boolean): StateView {
    return this.view(SPECTATOR_ID, online)
  }

  view(userId: string, online: (id: string) => boolean): StateView {
    const d = this.d
    const brief = (id: string) => ({ id, name: d.users[id]?.name ?? '?', online: online(id) })
    const isJudge = userId === d.judgeId
    const isSpectator = this.isSpectator(userId)
    const roomSeat = this.seatOf(userId)
    return {
      me: { id: userId, name: d.users[userId]?.name ?? '?', isJudge, isSpectator, seat: roomSeat },
      room: {
        code: d.code,
        config: d.config,
        judge: brief(d.judgeId),
        seats: d.seats.map((s) => (s ? brief(s) : null)),
        swaps: d.swaps.filter((s) => s.from === userId || s.to === userId).map((s) => ({ id: s.id, from: brief(s.from), to: brief(s.to) })),
        spectators: d.spectators.map(brief),
        inGame: this.inGame,
      },
      game: d.game ? this.gameView(userId, isJudge, isSpectator, brief) : null,
    }
  }

  private gameView(userId: string, isJudge: boolean, isSpectator: boolean, brief: (id: string) => PlayerView['user']): GameView {
    const g = this.d.game!
    const c = this.d.config
    const n = g.night
    const seat = g.seats.indexOf(userId)
    const mySeat = seat >= 0 ? seat : null
    const myRole = mySeat !== null ? g.roles[mySeat]! : null
    const meAlive = mySeat !== null && g.alive[mySeat]!
    const revealed = g.phase === 'revealed'
    const isWolf = myRole === 'werewolf'
    const night = this.isNightPhaseOf(g.phase)
    // 已公布出局的玩家进入观战：可以看到狼人、预言家、女巫的操作（当晚刚被刀、尚未天亮的不算）
    // 观战席同样是上帝视角，并且能看到全部身份
    const watching = (mySeat !== null && !meAlive) || isSpectator
    const godView = isJudge || watching
    const pending = godView && night ? this.pendingDeathsFor(g) : []

    const players: PlayerView[] = g.seats.map((uid, i) => {
      let role: Role | undefined
      if (isJudge || isSpectator || revealed || i === mySeat || i === g.idiotRevealed || (isWolf && g.roles[i] === 'werewolf')) role = g.roles[i]
      const p: PlayerView = { seat: i, user: brief(uid), alive: g.alive[i]! }
      if (role) p.role = role
      if (pending.includes(i)) p.pendingDeath = true
      return p
    })

    const wolfSeats = g.roles.map((r, i) => (r === 'werewolf' ? i : -1)).filter((i) => i >= 0)
    // 公布结果后，所有人都能回看各频道记录
    const showWolf = godView || isWolf || revealed
    const seerSeat = g.roles.indexOf('seer')
    const witchSeat = g.roles.indexOf('witch')
    const victim = typeof n.wolfTarget === 'number' ? n.wolfTarget : null
    const witchCanSee = n.witchInformed && g.antidote

    return {
      id: g.id,
      phase: g.phase,
      day: g.day,
      players,
      myId: userId,
      mySeat,
      myRole,
      meAlive,
      watching,
      peekRoles: mySeat !== null && !meAlive ? g.roles.slice() : null,
      wolf: showWolf
        ? {
            seats: wolfSeats,
            aliveSeats: wolfSeats.filter((s) => g.alive[s]),
            opened: n.wolfOpened,
            selections: n.wolfSel,
            confirmed: n.wolfConfirmed,
            target: n.wolfTarget,
            chat: g.wolfChat,
          }
        : null,
      seer:
        seerSeat >= 0 && (godView || myRole === 'seer')
          ? {
              seat: seerSeat,
              alive: g.alive[seerSeat]!,
              opened: n.seerOpened,
              selection: n.seerSel,
              confirmed: n.seerConfirmed,
              result: n.seerResult,
              history: g.seerHistory,
            }
          : null,
      witch:
        witchSeat >= 0 && (godView || myRole === 'witch')
          ? {
              seat: witchSeat,
              alive: g.alive[witchSeat]!,
              opened: n.witchOpened,
              informed: n.witchInformed,
              antidote: g.antidote,
              poison: g.poison,
              victim: godView || witchCanSee ? victim : null,
              canSeeVictim: witchCanSee,
              acted: n.witchActed,
              saved: n.saved,
              poisoned: n.poisoned,
              bothSameNight: c.witchBothSameNight,
              selfSave: c.witchSelfSave,
            }
          : null,
      vote: g.vote,
      hunter: g.hunter && (isJudge || isSpectator || g.hunter.seat === mySeat) ? g.hunter : null,
      idiot: g.idiot && (godView || g.idiot.seat === mySeat) ? g.idiot : null,
      idiotRevealed: g.idiotRevealed,
      hasSeer: c.seer > 0,
      hasWitch: c.witch > 0,
      seerDone: n.seerDone,
      witchDone: n.witchDone,
      announcements: g.announcements,
      judgeLog: isJudge || isSpectator || revealed ? g.judgeLog : null,
      ghostChat: isJudge || watching || revealed ? g.ghostChat : null,
      winner: isJudge || isSpectator || revealed ? g.winner : null,
      lastNightDeaths: g.lastNightDeaths,
    }
  }

  private isNightPhaseOf(p: Phase) {
    return ['night_start', 'wolf_wake', 'wolf_pick', 'night_menu', 'seer_wake', 'seer_pick', 'seer_result', 'witch_wake', 'witch_act'].includes(p)
  }

  private pendingDeathsFor(g: GameState) {
    const n = g.night
    const s = new Set<number>()
    if (n.wolfConfirmed && typeof n.wolfTarget === 'number' && !n.saved) s.add(n.wolfTarget)
    if (n.poisoned !== null) s.add(n.poisoned)
    return [...s]
  }
}

export { ROLE_NAME }
