import { expect, test } from 'bun:test'
import { GOD_ROLES, type ClientMessage, type Role, type RoomConfig } from '../../shared/types'
import { Room } from './room'

const cfg: RoomConfig = { werewolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 2, witchBothSameNight: false, witchSelfSave: false, allowSpectators: false }

function setup(config = cfg) {
  const { room, user: judge } = Room.create('1234', config, '法官')
  const ids: string[] = []
  for (let i = 0; i < room.d.seats.length; i++) ids.push(room.join(`p${i + 1}`).id)
  const J = (step: any) => room.handle(judge.id, { type: 'judge', step })
  const as = (seat: number, msg: ClientMessage) => room.handle(room.d.game!.seats[seat]!, msg)
  const fixRoles = (roles: Role[]) => {
    room.handle(judge.id, { type: 'start' })
    room.d.game!.roles = roles
  }
  return { room, judge, ids, J, as, fixRoles }
}

const ROLES: Role[] = ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager']

function night(s: ReturnType<typeof setup>, kill: number | 'none', opts: { save?: boolean; poison?: number | null; check?: number } = {}) {
  const { J, as, room } = s
  const g = () => room.d.game!
  J('nightStart')
  J('wolfWake')
  const wolves = g().roles.map((r, i) => (r === 'werewolf' && g().alive[i] ? i : -1)).filter((i) => i >= 0)
  expect(() => J('wolfPick')).toThrow('还有狼人没有睁眼')
  for (const w of wolves) as(w, { type: 'openEyes' })
  J('wolfPick')
  as(wolves[0]!, { type: 'wolfSelect', choice: kill })
  if (wolves.length > 1) {
    // 意见不统一：全体确定后作废，重新选择
    as(wolves[1]!, { type: 'wolfSelect', choice: kill === 'none' ? 0 : 'none' })
    for (const w of wolves) as(w, { type: 'wolfConfirm' })
    expect(g().night.wolfPending).toBeNull()
    expect(g().night.wolfRound).toBe(2)
    expect(g().night.wolfNote).toContain('意见不统一')
    for (const w of wolves) as(w, { type: 'wolfSelect', choice: kill })
  }
  as(wolves[0]!, { type: 'wolfChat', text: '刀他' })
  expect(() => as(wolves[0]!, { type: 'wolfFinal' })).toThrow('还没有统一意见')
  for (const w of wolves) as(w, { type: 'wolfConfirm' })
  expect(g().night.wolfPending).toBe(kill)
  as(wolves[0]!, { type: 'wolfFinal' })
  J('wolfClose')
  // 神职出局后法官仍完整走流程，只是不需要玩家操作
  const seer = g().roles.indexOf('seer')
  J('seerWake')
  if (g().alive[seer]) as(seer, { type: 'openEyes' })
  J('seerPick')
  if (g().alive[seer]) {
    as(seer, { type: 'seerSelect', seat: opts.check ?? 0 })
    as(seer, { type: 'seerConfirm' })
  }
  J('seerReveal')
  J('seerClose')
  const witch = g().roles.indexOf('witch')
  J('witchWake')
  if (g().alive[witch]) as(witch, { type: 'openEyes' })
  J('witchInform')
  if (g().alive[witch]) as(witch, { type: 'witchAct', save: !!opts.save, poison: opts.poison ?? null })
  J('witchClose')
  J('dawn')
}

function vote(s: ReturnType<typeof setup>, choices: Record<number, number | 'abstain'>) {
  for (const [seat, c] of Object.entries(choices)) {
    s.as(Number(seat), { type: 'voteSelect', choice: c })
    s.as(Number(seat), { type: 'voteConfirm' })
  }
}

test('lobby: swap with judge', () => {
  const s = setup()
  const p = s.room.d.seats[2]!
  s.room.handle(p, { type: 'swapRequest', to: s.judge.id })
  const req = s.room.d.swaps[0]!
  s.room.handle(s.judge.id, { type: 'swapRespond', id: req.id, accept: true })
  expect(s.room.d.judgeId).toBe(p)
  expect(s.room.d.seats[2]).toBe(s.judge.id)
})

test('full game: seer checks, witch saves, vote, good wins', () => {
  const s = setup()
  const { J, as, room } = s
  s.fixRoles(ROLES)
  night(s, 5, { save: true, check: 0 })
  const g = room.d.game!
  expect(g.seerHistory[0]).toEqual({ day: 1, seat: 0, result: 'bad' })
  expect(g.lastNightDeaths).toEqual([])
  expect(g.phase).toBe('day')
  J('voteStart')
  // seer view sees result; villager does not see seer info
  expect(room.view(g.seats[2]!, () => true).game!.seer).not.toBeNull()
  expect(room.view(g.seats[5]!, () => true).game!.seer).toBeNull()
  vote(s, { 0: 1, 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 'abstain' })
  expect(g.alive[0]).toBe(false)
  expect(g.phase).toBe('vote_result')
  // witch has no antidote; can't see victim
  night(s, 6, { poison: 1, check: 1 })
  expect(g.day).toBe(2)
  expect(g.lastNightDeaths).toEqual([1, 6])
  expect(g.winner).toBe('good')
  expect(g.phase).toBe('game_over')
  J('reveal')
  expect(room.view(g.seats[3]!, () => true).game!.players.every((p) => p.role)).toBe(true)
  expect(room.inGame).toBe(false)
})

test('hunter shoots at night when knifed, not when poisoned; tie handling', () => {
  const s = setup()
  const { J, room } = s
  s.fixRoles(ROLES)
  night(s, 4)
  const g = room.d.game!
  expect(g.phase).toBe('hunter')
  expect(() => s.as(5, { type: 'hunterShoot', target: 0 })).toThrow()
  s.as(4, { type: 'hunterShoot', target: 0 })
  expect(g.alive[0]).toBe(false)
  expect(g.phase).toBe('day')
  J('voteStart')
  vote(s, { 1: 2, 2: 1, 3: 1, 5: 2, 6: 'abstain' })
  expect(g.vote!.result!.tie).toEqual([1, 2])
  J('tieRevote')
  expect(g.vote!.voters).toEqual([3, 5, 6])
  expect(() => s.as(3, { type: 'voteSelect', choice: 5 })).toThrow('PK')
  vote(s, { 3: 1, 5: 2, 6: 'abstain' })
  expect(g.vote!.result!.tie).toEqual([1, 2])
  room.handle(s.judge.id, { type: 'tieChoose', seat: 1 })
  // both wolves dead -> good wins
  expect(g.winner).toBe('good')
})

test('witch cannot self-save; poisoned hunter cannot shoot; dead seer flow skipped', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const g = s.room.d.game!
  expect(() => night(s, 3, { save: true })).toThrow('女巫不能自救')
  // continue: witch acts with poison on hunter
  s.as(3, { type: 'witchAct', save: false, poison: 4 })
  s.J('witchClose')
  s.J('dawn')
  expect(g.lastNightDeaths).toEqual([3, 4])
  expect(g.phase).toBe('day')
  s.J('voteStart')
  vote(s, { 0: 2, 1: 2, 2: 'abstain', 5: 2, 6: 2 })
  // seer out -> all gods dead -> wolves win
  expect(g.winner).toBe('wolf')
})

test('self knife and none', () => {
  const s = setup()
  s.fixRoles(ROLES)
  night(s, 0)
  expect(s.room.d.game!.lastNightDeaths).toEqual([0])
  s.J('voteStart')
  vote(s, { 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 5: 'abstain', 6: 'abstain' })
  expect(s.room.d.game!.vote!.result!.resolved).toBe(true)
  night(s, 'none', { check: 1 })
  expect(s.room.d.game!.lastNightDeaths).toEqual([])
})

test('judge sees pending death before dawn, others do not', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room } = s
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 5 }); as(1, { type: 'wolfSelect', choice: 5 }); as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(0, { type: 'wolfFinal' })
  expect(room.view(s.judge.id, () => true).game!.players[5]!.pendingDeath).toBe(true)
  expect(room.view(room.d.game!.seats[1]!, () => true).game!.players[5]!.pendingDeath).toBeUndefined()
  expect(room.view(room.d.game!.seats[1]!, () => true).game!.players[0]!.role).toBe('werewolf')
  expect(room.view(room.d.game!.seats[5]!, () => true).game!.players[0]!.role).toBeUndefined()
})

test('judge can abort a game', () => {
  const s = setup()
  s.fixRoles(ROLES)
  expect(() => s.room.handle(s.room.d.seats[0]!, { type: 'abort' })).toThrow('只有法官')
  s.room.handle(s.judge.id, { type: 'abort' })
  expect(s.room.d.game).toBeNull()
  expect(s.room.inGame).toBe(false)
})

test('spectator view only exposes public info', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room } = s
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 5 }); as(1, { type: 'wolfSelect', choice: 5 }); as(0, { type: 'wolfChat', text: 'secret' }); as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(0, { type: 'wolfFinal' })
  let v = room.spectatorView(() => true)
  expect(v.me.isJudge).toBe(false)
  expect(v.me.seat).toBeNull()
  const g = v.game!
  expect(g.players.every((p) => p.role === undefined && !p.pendingDeath)).toBe(true)
  expect(g.wolf).toBeNull()
  expect(g.seer).toBeNull()
  expect(g.witch).toBeNull()
  expect(g.hunter).toBeNull()
  expect(g.judgeLog).toBeNull()
  expect(g.winner).toBeNull()
  expect(g.peekRoles).toBeNull()
  expect(JSON.stringify(v)).not.toContain('secret')
  // 公布结果后可见全部身份
  room.d.game!.phase = 'game_over'
  room.d.game!.winner = 'good'
  J('reveal')
  v = room.spectatorView(() => true)
  expect(v.game!.players.every((p) => p.role)).toBe(true)
  expect(v.game!.winner).toBe('good')
})

test('judge can speak in wolf channel, other players cannot', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room, judge } = s
  J('nightStart'); J('wolfWake')
  room.handle(judge.id, { type: 'wolfChat', text: '请尽快统一意见' })
  expect(() => as(2, { type: 'wolfChat', text: 'hi' })).toThrow('你不能发言')
  as(0, { type: 'wolfChat', text: '收到' })
  const chat = room.view(room.d.game!.seats[1]!, () => true).game!.wolf!.chat
  expect(chat.map((m) => [m.seat, m.text])).toEqual([[-1, '请尽快统一意见'], [0, '收到']])
})

test('dead players can watch wolf / seer / witch actions; alive players cannot', () => {
  const s = setup()
  s.fixRoles(ROLES)
  // 第一夜刀 5号（平民），天亮后 5号出局
  night(s, 5, { check: 0 })
  const { J, as, room } = s
  const g = room.d.game!
  expect(g.alive[5]).toBe(false)
  J('voteStart')
  vote(s, { 0: 'abstain', 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 6: 'abstain' })
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 6 }); as(0, { type: 'wolfChat', text: '刀6' })
  const dead = room.view(g.seats[5]!, () => true).game!
  expect(dead.watching).toBe(true)
  expect(dead.wolf!.selections[0]).toBe(6)
  // 狼人频道整局保留，并带有阶段标签
  expect(dead.wolf!.chat.map((m) => [m.label, m.text])).toEqual([['第1夜', '刀他'], ['第2夜', '刀6']])
  expect(dead.seer!.history).toEqual([{ day: 1, seat: 0, result: 'bad' }])
  expect(dead.witch).not.toBeNull()
  const alive = room.view(g.seats[6]!, () => true).game!
  expect(alive.watching).toBe(false)
  expect(alive.wolf).toBeNull()
  expect(alive.seer).toBeNull()
  expect(alive.witch).toBeNull()
  // 观战者能看到女巫当晚的刀口
  as(1, { type: 'wolfSelect', choice: 6 }); as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(0, { type: 'wolfFinal' }); J('wolfClose')
  J('witchWake'); as(3, { type: 'openEyes' }); J('witchInform')
  expect(room.view(g.seats[5]!, () => true).game!.witch!.victim).toBe(6)
  expect(room.view(g.seats[5]!, () => true).game!.players[6]!.pendingDeath).toBe(true)
})

test('spectators: opt-in, max 5, god view, read-only', () => {
  const s = setup()
  expect(() => s.room.spectate('看客')).toThrow('不允许观战')
  s.room.d.config.allowSpectators = true
  const specs = [1, 2, 3, 4, 5].map((i) => s.room.spectate(`看客${i}`))
  expect(() => s.room.spectate('看客6')).toThrow('观战席已满')
  s.fixRoles(ROLES)
  const { J, as, room } = s
  const spec = specs[0]!
  // 游戏中也能观战（先移除一位腾出位置）
  room.handle(specs[4]!.id, { type: 'leave' })
  expect(room.d.spectators.length).toBe(4)
  room.spectate('迟到的看客')
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 5 }); as(0, { type: 'wolfChat', text: '刀5' })
  const v = room.view(spec.id, () => true)
  expect(v.me.isSpectator).toBe(true)
  expect(v.game!.watching).toBe(true)
  expect(v.game!.players.every((p) => p.role)).toBe(true)
  expect(v.game!.wolf!.chat[0]!.text).toBe('刀5')
  expect(v.game!.judgeLog).not.toBeNull()
  // 只读：任何操作都被拒绝
  for (const msg of [{ type: 'wolfChat', text: 'x' }, { type: 'judge', step: 'wolfClose' }, { type: 'voteSelect', choice: 1 }, { type: 'sit', seat: 0 }] as const)
    expect(() => room.handle(spec.id, msg as never)).toThrow('观战中只能观看')
  // 法官可随时请出观战者
  room.handle(s.judge.id, { type: 'kick', userId: spec.id })
  expect(room.isSpectator(spec.id)).toBe(false)
})

test('ghost channel: dead players, spectators and judge only', () => {
  const s = setup()
  s.room.d.config.allowSpectators = true
  const spec = s.room.spectate('看客')
  s.fixRoles(ROLES)
  night(s, 5, { check: 0 })
  const { as, room, judge, J } = s
  const g = room.d.game!
  // 第一天出局，第二夜才能进入观战频道
  expect(() => as(5, { type: 'ghostChat', text: '太早了' })).toThrow('第二晚')
  J('voteStart')
  vote(s, { 0: 'abstain', 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 6: 'abstain' })
  J('nightStart')
  as(5, { type: 'ghostChat', text: '我是平民，冤' })
  room.handle(spec.id, { type: 'ghostChat', text: '节哀' })
  room.handle(judge.id, { type: 'ghostChat', text: '请保持安静' })
  expect(() => as(6, { type: 'ghostChat', text: '我也想说' })).toThrow('只有出局玩家')
  const chat = room.view(g.seats[5]!, () => true).game!.ghostChat!
  expect(chat.map((m) => m.seat)).toEqual([5, -2, -1])
  expect(room.view(spec.id, () => true).game!.ghostChat!.length).toBe(3)
  expect(room.view(g.seats[6]!, () => true).game!.ghostChat).toBeNull()
})

test('wolf channel persists across nights but only allows posting at night', () => {
  const s = setup()
  s.fixRoles(ROLES)
  night(s, 5, { check: 0 })
  const { J, as, room, judge } = s
  // 白天不能发言（狼人和法官都不行），但历史记录仍可见
  expect(() => as(0, { type: 'wolfChat', text: '白天别暴露' })).toThrow('只能在夜晚发言')
  expect(() => room.handle(judge.id, { type: 'wolfChat', text: '法官提醒' })).toThrow('只能在夜晚发言')
  expect(() => as(5, { type: 'wolfChat', text: 'x' })).toThrow('你不能发言')
  J('voteStart')
  vote(s, { 0: 'abstain', 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 6: 'abstain' })
  J('nightStart')
  as(0, { type: 'wolfChat', text: '今晚刀谁' })
  const chat = room.view(room.d.game!.seats[1]!, () => true).game!.wolf!.chat
  expect(chat.map((m) => [m.label, m.text])).toEqual([['第1夜', '刀他'], ['第2夜', '今晚刀谁']])
})

const IDIOT_ROLES: Role[] = ['werewolf', 'werewolf', 'seer', 'witch', 'idiot', 'villager', 'villager']

test('idiot: reveal when voted out → immune, cannot vote nor be voted', () => {
  const s = setup()
  s.fixRoles(IDIOT_ROLES)
  const { J, as, room } = s
  const g = room.d.game!
  night(s, 'none', { check: 0 })
  J('voteStart')
  vote(s, { 0: 4, 1: 4, 2: 4, 3: 'abstain', 4: 'abstain', 5: 'abstain', 6: 'abstain' })
  expect(g.phase).toBe('idiot')
  // 对外不透露是白痴
  expect(room.view(g.seats[6]!, () => true).game!.idiot).toBeNull()
  expect(room.view(g.seats[6]!, () => true).game!.vote!.result!.note).toBe('5号 得票最多，等待法官处理')
  expect(() => as(5, { type: 'idiotDecide', reveal: true })).toThrow('你不是待决定的白痴')
  as(4, { type: 'idiotDecide', reveal: true })
  expect(g.alive[4]).toBe(true)
  expect(g.idiotRevealed).toBe(4)
  // 白痴算神职：屠边判定中计入神职
  expect(GOD_ROLES).toContain('idiot')
  expect(room.view(g.seats[6]!, () => true).game!.players[4]!.role).toBe('idiot')
  night(s, 'none', { check: 1 })
  expect(g.day).toBe(2)
  J('voteStart')
  expect(g.vote!.voters).not.toContain(4)
  expect(() => as(0, { type: 'voteSelect', choice: 4 })).toThrow('不能被投票')
})

test('idiot: not revealing means exiled', () => {
  const s = setup()
  s.fixRoles(IDIOT_ROLES)
  const { J, as, room } = s
  night(s, 'none', { check: 0 })
  J('voteStart')
  vote(s, { 0: 4, 1: 4, 2: 4, 3: 'abstain', 4: 'abstain', 5: 'abstain', 6: 'abstain' })
  as(4, { type: 'idiotDecide', reveal: false })
  expect(room.d.game!.alive[4]).toBe(false)
  expect(room.d.game!.idiotRevealed).toBeNull()
  expect(room.d.game!.phase).toBe('vote_result')
})

test('after reveal, everyone can read all channels', () => {
  const s = setup()
  s.fixRoles(ROLES)
  night(s, 5, { check: 0 })
  const { as, room, J } = s
  J('voteStart')
  vote(s, { 0: 'abstain', 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 6: 'abstain' })
  J('nightStart')
  as(5, { type: 'ghostChat', text: '我死得冤' })
  const alive = () => room.view(room.d.game!.seats[6]!, () => true).game!
  expect(alive().wolf).toBeNull()
  expect(alive().ghostChat).toBeNull()
  room.d.game!.phase = 'game_over'
  room.d.game!.winner = 'good'
  J('reveal')
  expect(alive().wolf!.chat.map((m) => m.text)).toEqual(['刀他'])
  expect(alive().ghostChat!.map((m) => m.text)).toEqual(['我死得冤'])
  // 结束后不能再发言
  expect(() => as(5, { type: 'ghostChat', text: 'x' })).toThrow('游戏未开始')
})

test('dead seer / witch: judge walks the full flow as if they were alive', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, room } = s
  const g = room.d.game!
  g.alive[2] = false // 预言家
  g.alive[3] = false // 女巫
  J('nightStart'); J('wolfWake'); s.as(0, { type: 'openEyes' }); s.as(1, { type: 'openEyes' }); J('wolfPick')
  s.as(0, { type: 'wolfSelect', choice: 5 }); s.as(1, { type: 'wolfSelect', choice: 5 }); s.as(0, { type: 'wolfConfirm' }); s.as(1, { type: 'wolfConfirm' }); s.as(0, { type: 'wolfFinal' }); J('wolfClose')
  const phases: string[] = []
  for (const step of ['seerWake', 'seerPick', 'seerReveal', 'seerClose', 'witchWake', 'witchInform', 'witchClose'] as const) {
    // 不能跳步
    if (step === 'seerPick') expect(() => J('seerClose')).toThrow()
    if (step === 'witchInform') expect(() => J('witchClose')).toThrow()
    J(step)
    phases.push(g.phase)
  }
  expect(phases).toEqual(['seer_wake', 'seer_pick', 'seer_result', 'night_menu', 'witch_wake', 'witch_act', 'night_menu'])
  expect(g.seerHistory).toEqual([])
  J('dawn')
  expect(g.lastNightDeaths).toEqual([5])
})

test('players dead on day 1 cannot watch until night 2; later deaths watch immediately', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room } = s
  const g = room.d.game!
  night(s, 5, { check: 0 }) // 第一夜刀 6号（seat 5）
  const v = () => room.view(g.seats[5]!, () => true).game!
  expect(v().watchLocked).toBe(true)
  expect(v().watching).toBe(false)
  expect(v().wolf).toBeNull()
  expect(v().ghostChat).toBeNull()
  expect(v().peekRoles).toBeNull()
  expect(v().players.filter((p) => p.role).length).toBe(1) // 只看得到自己
  // 第一天被投出的玩家同样受限
  J('voteStart')
  vote(s, { 0: 3, 1: 3, 2: 3, 3: 'abstain', 4: 3, 6: 3 })
  expect(g.alive[3]).toBe(false)
  expect(room.view(g.seats[3]!, () => true).game!.watchLocked).toBe(true)
  // 第二夜开始解锁
  J('nightStart')
  expect(v().watchLocked).toBe(false)
  expect(v().watching).toBe(true)
  expect(v().wolf).not.toBeNull()
  expect(v().peekRoles).not.toBeNull()
  // 第二天出局的玩家公布后立即可观战
  J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 4 }); as(1, { type: 'wolfSelect', choice: 4 }); as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(0, { type: 'wolfFinal' }); J('wolfClose')
  for (const step of ['seerWake'] as const) J(step)
  as(2, { type: 'openEyes' }); J('seerPick'); as(2, { type: 'seerSelect', seat: 1 }); as(2, { type: 'seerConfirm' }); J('seerReveal'); J('seerClose')
  J('witchWake'); J('witchInform'); J('witchClose') // 女巫已出局，空过
  J('dawn')
  const d2 = room.view(g.seats[4]!, () => true).game!
  expect(g.alive[4]).toBe(false)
  expect(d2.watchLocked).toBe(false)
  expect(d2.watching).toBe(true)
})

test('witch / hunter drafts are mirrored to god view only', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room, judge } = s
  const g = room.d.game!
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  as(0, { type: 'wolfSelect', choice: 4 }); as(1, { type: 'wolfSelect', choice: 4 }); as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(0, { type: 'wolfFinal' }); J('wolfClose')
  J('seerWake'); as(2, { type: 'openEyes' }); J('seerPick'); as(2, { type: 'seerSelect', seat: 0 }); as(2, { type: 'seerConfirm' }); J('seerReveal'); J('seerClose')
  J('witchWake'); as(3, { type: 'openEyes' }); J('witchInform')
  expect(() => as(5, { type: 'witchDraft', save: false, poison: true, target: 1 })).toThrow()
  as(3, { type: 'witchDraft', save: false, poison: true, target: 1 })
  expect(room.view(judge.id, () => true).game!.witch!.draft).toEqual({ save: false, poison: true, target: 1 })
  expect(room.view(g.seats[6]!, () => true).game!.witch).toBeNull()
  as(3, { type: 'witchAct', save: false, poison: null }); J('witchClose'); J('dawn')
  // 猎人（seat 4）被刀，瞄准过程同步给法官
  expect(g.phase).toBe('hunter')
  as(4, { type: 'hunterDraft', target: 0 })
  expect(room.view(judge.id, () => true).game!.hunter!.draft).toBe(0)
  expect(room.view(g.seats[6]!, () => true).game!.hunter).toBeNull()
})

test('extend: any member (incl. spectators) can extend; idle countdown in room view', () => {
  const s = setup()
  s.room.d.config.allowSpectators = true
  const spec = s.room.spectate('看客')
  s.room.d.lastActiveAt = Date.now() - 29 * 60_000
  expect(s.room.view(s.judge.id, () => true).room.idleRemainingMs).toBeLessThan(61_000)
  expect(s.room.isIdle(Date.now(), 30 * 60_000)).toBe(false)
  // extend 本身合法（重置计时由传输层的 touch 完成）
  expect(s.room.handle(spec.id, { type: 'extend' })).toEqual({})
  s.room.touch()
  expect(s.room.view(s.judge.id, () => true).room.idleRemainingMs).toBeGreaterThan(29 * 60_000)
})

test('wolves: lock, unlock, cancel final confirm restarts the pick', () => {
  const s = setup()
  s.fixRoles(ROLES)
  const { J, as, room } = s
  const n = () => room.d.game!.night
  J('nightStart'); J('wolfWake'); as(0, { type: 'openEyes' }); as(1, { type: 'openEyes' }); J('wolfPick')
  expect(() => as(0, { type: 'wolfConfirm' })).toThrow('请先选择')
  as(0, { type: 'wolfSelect', choice: 5 })
  as(0, { type: 'wolfConfirm' })
  // 锁定后不能改，撤回后可以改
  expect(() => as(0, { type: 'wolfSelect', choice: 6 })).toThrow('请先取消')
  as(0, { type: 'wolfCancel' })
  expect(n().wolfLocked).toEqual([])
  as(0, { type: 'wolfSelect', choice: 6 }); as(0, { type: 'wolfConfirm' })
  as(1, { type: 'wolfSelect', choice: 6 }); as(1, { type: 'wolfConfirm' })
  expect(n().wolfPending).toBe(6)
  expect(() => J('wolfClose')).toThrow()
  // 最终确认弹窗里取消：所有人重新选
  as(1, { type: 'wolfCancel' })
  expect(n().wolfPending).toBeNull()
  expect(n().wolfSel).toEqual({})
  expect(n().wolfLocked).toEqual([])
  expect(n().wolfNote).toContain('2号 取消了猎杀 7号')
  as(0, { type: 'wolfSelect', choice: 4 }); as(1, { type: 'wolfSelect', choice: 4 })
  as(0, { type: 'wolfConfirm' }); as(1, { type: 'wolfConfirm' }); as(1, { type: 'wolfFinal' })
  expect(n().wolfTarget).toBe(4)
  expect(() => as(0, { type: 'wolfCancel' })).toThrow('已经确认猎杀')
  J('wolfClose')
})

test('vote: confirmed ballots cannot be changed', () => {
  const s = setup()
  s.fixRoles(ROLES)
  night(s, 'none')
  s.J('voteStart')
  s.as(0, { type: 'voteSelect', choice: 5 }); s.as(0, { type: 'voteConfirm' })
  expect(() => s.as(0, { type: 'voteSelect', choice: 6 })).toThrow('已经确认投票')
})

test('witch self-save: only on the first night when enabled', () => {
  const s = setup({ ...cfg, witchSelfSave: true })
  s.fixRoles(ROLES)
  const g = s.room.d.game!
  // 第一晚女巫被刀，可以自救
  night(s, 3, { save: true })
  expect(g.alive[3]).toBe(true)
  expect(g.antidote).toBe(false)
  s.J('voteStart')
  vote(s, { 0: 'abstain', 1: 'abstain', 2: 'abstain', 3: 'abstain', 4: 'abstain', 5: 'abstain', 6: 'abstain' })
  s.J('nightStart')
  // 第二晚解药已用完；把解药补回来，确认第二晚也不能自救
  g.antidote = true
  s.J('wolfWake'); s.as(0, { type: 'openEyes' }); s.as(1, { type: 'openEyes' }); s.J('wolfPick')
  s.as(0, { type: 'wolfSelect', choice: 3 }); s.as(1, { type: 'wolfSelect', choice: 3 })
  s.as(0, { type: 'wolfConfirm' }); s.as(1, { type: 'wolfConfirm' }); s.as(0, { type: 'wolfFinal' }); s.J('wolfClose')
  s.J('seerWake'); s.as(2, { type: 'openEyes' }); s.J('seerPick'); s.as(2, { type: 'seerSelect', seat: 0 }); s.as(2, { type: 'seerConfirm' }); s.J('seerReveal'); s.J('seerClose')
  s.J('witchWake'); s.as(3, { type: 'openEyes' }); s.J('witchInform')
  expect(s.room.view(g.seats[3]!, () => true).game!.witch!.selfSave).toBe(false)
  expect(() => s.as(3, { type: 'witchAct', save: true, poison: null })).toThrow('女巫只有第一晚可以自救')
})
