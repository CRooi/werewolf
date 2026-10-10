import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const btn = 'flex size-8 items-center justify-center rounded-full border border-gold/40 bg-secondary text-gold active:scale-90 transition disabled:opacity-30'
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="减少">
        <Minus className="size-4" />
      </button>
      <span className={cn('w-6 text-center font-display text-2xl tabular-nums', value ? 'text-gold-soft' : 'text-muted-foreground')}>{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="增加">
        <Plus className="size-4" />
      </button>
    </div>
  )
}
