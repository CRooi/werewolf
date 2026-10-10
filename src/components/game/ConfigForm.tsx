import { MAX_SEATS, ROLE_ORDER, seatCount, type RoomConfig } from '@shared/types'
import { Switch } from '@/components/ui/switch'
import { RoleCard, roleLabel, ROLE_TAGLINE } from './RoleCard'
import { Stepper } from './Stepper'

const MAX: Record<string, number> = { werewolf: 6, seer: 1, witch: 1, hunter: 1, villager: 8 }

/** 板子配置：各角色数量 + 女巫规则 */
export function ConfigForm({ value, onChange }: { value: RoomConfig; onChange: (c: RoomConfig) => void }) {
  const total = seatCount(value)
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="flex items-center gap-3 rounded-xl border border-gold/15 bg-black/25 p-2 pr-3">
            <RoleCard role={r} size="sm" className="w-11" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight">{roleLabel(r)}</div>
              <div className="truncate text-xs text-muted-foreground">{ROLE_TAGLINE[r]}</div>
            </div>
            <Stepper
              value={value[r]}
              min={r === 'werewolf' ? 1 : 0}
              max={Math.min(MAX[r]!, value[r] + MAX_SEATS - total)}
              onChange={(v) => onChange({ ...value, [r]: v })}
            />
          </div>
        ))}
      </div>
      <div className="divider-ornament text-xs">
        <span className="font-display">共 {total} 位玩家 · {value.werewolf} 狼 {total - value.werewolf} 好人</span>
      </div>
      {value.witch > 0 && (
        <div className="space-y-2 rounded-xl border border-gold/15 bg-black/25 p-3">
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">解药毒药可同晚使用</div>
              <div className="text-xs text-muted-foreground">关闭时每晚只能二选一</div>
            </div>
            <Switch checked={value.witchBothSameNight} onCheckedChange={(v) => onChange({ ...value, witchBothSameNight: v })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">女巫可以自救</div>
              <div className="text-xs text-muted-foreground">女巫被刀时能否对自己用解药</div>
            </div>
            <Switch checked={value.witchSelfSave} onCheckedChange={(v) => onChange({ ...value, witchSelfSave: v })} />
          </label>
        </div>
      )}
    </div>
  )
}
