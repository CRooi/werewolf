import { expect, test } from 'bun:test'
import type { ClientMessage, Role, RoomConfig } from '../../shared/types'
import { Room } from './room'

const cfg: RoomConfig = { werewolf: 2, seer: 1, witch: 1, hunter: 1, villager: 2, witchBothSameNight: false, witchSelfSave: false }

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
    as(wolves[1]!, { type: 'wolfSelect', choice: kill === 'none' ? 0 : 'none' })
    expect(() => as(wolves[0]!, { type: 'wolfConfirm' })).toThrow('请统一意见。')
    as(wolves[1]!, { type: 'wolfSelect', choice: kill })
  }
  as(wolves[0]!, { type: 'wolfChat', text: '刀他' })
  as(wolves[0]!, { type: 'wolfConfirm' })
  J('wolfClose')
  const seer = g().roles.indexOf('seer')
  J('seerWake')
  if (g().alive[seer]) {
    as(seer, { type: 'openEyes' })
    J('seerPick')
    as(seer, { type: 'seerSelect', seat: opts.check ?? 0 })
    as(seer, { type: 'seerConfirm' })
    J('seerReveal')
  }
  J('seerClose')
  const witch = g().roles.indexOf('witch')
  J('witchWake')
  if (g().alive[witch]) {
    as(witch, { type: 'openEyes' })
    J('witchInform')
    as(witch, { type: 'witchAct', save: !!opts.save, poison: opts.poison ?? null })
  }
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
  as(0, { type: 'wolfSelect', choice: 5 }); as(1, { type: 'wolfSelect', choice: 5 }); as(0, { type: 'wolfConfirm' })
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
  as(0, { type: 'wolfSelect', choice: 5 }); as(1, { type: 'wolfSelect', choice: 5 }); as(0, { type: 'wolfChat', text: 'secret' }); as(0, { type: 'wolfConfirm' })
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
  expect(dead.wolf!.chat[0]!.text).toBe('刀6')
  expect(dead.seer!.history).toEqual([{ day: 1, seat: 0, result: 'bad' }])
  expect(dead.witch).not.toBeNull()
  const alive = room.view(g.seats[6]!, () => true).game!
  expect(alive.watching).toBe(false)
  expect(alive.wolf).toBeNull()
  expect(alive.seer).toBeNull()
  expect(alive.witch).toBeNull()
  // 观战者能看到女巫当晚的刀口
  as(1, { type: 'wolfSelect', choice: 6 }); as(0, { type: 'wolfConfirm' }); J('wolfClose')
  J('witchWake'); as(3, { type: 'openEyes' }); J('witchInform')
  expect(room.view(g.seats[5]!, () => true).game!.witch!.victim).toBe(6)
  expect(room.view(g.seats[5]!, () => true).game!.players[6]!.pendingDeath).toBe(true)
})
