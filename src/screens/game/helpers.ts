import type { GameView, Phase } from '@shared/types'

export const NIGHT_PHASES: Phase[] = ['night_start', 'wolf_wake', 'wolf_pick', 'night_menu', 'seer_wake', 'seer_pick', 'seer_result', 'witch_wake', 'witch_act']

export const isNight = (p: Phase) => NIGHT_PHASES.includes(p)

export const PHASE_TITLE: Record<Phase, string> = {
  dealt: '身份已发放',
  night_start: '天黑请闭眼',
  wolf_wake: '狼人请睁眼',
  wolf_pick: '狼人请确认猎杀对象',
  night_menu: '夜深了…',
  seer_wake: '预言家请睁眼',
  seer_pick: '预言家请选择查验对象',
  seer_result: '预言家请查看结果',
  witch_wake: '女巫请睁眼',
  witch_act: '女巫请用药',
  day: '天亮了',
  hunter: '天亮了',
  idiot: '投票结果',
  voting: '投票放逐',
  vote_result: '投票结果',
  game_over: '游戏结束',
  revealed: '游戏结束',
}

export const seatName = (g: GameView, seat: number) => `${seat + 1}号 ${g.players[seat]?.user.name ?? ''}`

/** 玩家当前需要处理的操作；用于自动弹窗与震动提醒 */
export type ActionKind = 'wolfOpen' | 'wolf' | 'seerOpen' | 'seer' | 'witchOpen' | 'witch' | 'vote' | 'hunter' | 'idiot'

export function pendingAction(g: GameView): { kind: ActionKind; key: string } | null {
  const me = g.mySeat
  if (me === null) return null
  const k = (kind: ActionKind, extra = '') => ({ kind, key: `${g.id}:${kind}:${g.day}${extra}` })
  if (g.phase === 'hunter' && g.hunter && g.hunter.seat === me && !g.hunter.done) return k('hunter')
  if (g.phase === 'idiot' && g.idiot && g.idiot.seat === me) return k('idiot')
  if (!g.meAlive) return null
  switch (g.phase) {
    case 'wolf_wake':
      if (g.myRole === 'werewolf' && !g.wolf?.opened.includes(me)) return k('wolfOpen')
      return null
    case 'wolf_pick':
      if (g.myRole === 'werewolf') return k('wolf')
      return null
    case 'seer_wake':
      if (g.myRole === 'seer' && !g.seer?.opened) return k('seerOpen')
      return null
    case 'seer_pick':
    case 'seer_result':
      if (g.myRole === 'seer') return k('seer')
      return null
    case 'witch_wake':
      if (g.myRole === 'witch' && !g.witch?.opened) return k('witchOpen')
      return null
    case 'witch_act':
      if (g.myRole === 'witch') return k('witch')
      return null
    case 'voting':
      if (g.vote?.voters.includes(me)) return k('vote', `:${g.vote.round}`)
      return null
    default:
      return null
  }
}

export function vibrate(ms: number | number[] = 200) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 不支持震动 */
  }
}
