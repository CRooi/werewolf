import { ROLE_NAME, type Role } from '@shared/types'
import { cn } from '@/lib/utils'
import { ROLE_THEME, RoleEmblem, type ArtRole } from '@/components/art/RoleArt'

export const ROLE_TAGLINE: Record<ArtRole, string> = {
  werewolf: '月圆之夜，猎杀开始',
  seer: '每晚查验一人的真身',
  witch: '一瓶解药，一瓶毒药',
  hunter: '倒下之时，带走一人',
  idiot: '被放逐时亮牌，免死一次',
  villager: '用推理守护村庄',
  judge: '主持公道，推动长夜',
  unknown: '身份未知',
}

export function roleLabel(r: ArtRole) {
  return r === 'judge' ? '法官' : r === 'unknown' ? '???' : ROLE_NAME[r as Role]
}

/** 身份牌：金边卡框 + 纹章插画 + 名称条 */
export function RoleCard({
  role,
  size = 'md',
  className,
  flip,
  dead,
}: {
  role: ArtRole
  size?: 'sm' | 'md' | 'lg'
  className?: string
  flip?: boolean
  dead?: boolean
}) {
  const t = ROLE_THEME[role]
  const w = size === 'sm' ? 'w-16' : size === 'md' ? 'w-28' : 'w-44'
  return (
    <div
      className={cn('relative shrink-0 select-none', w, flip && 'animate-flip-in', className)}
      style={{ aspectRatio: '120 / 170' }}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[10%/7%] p-[5%]"
        style={{
          background: 'linear-gradient(160deg,#fff1c4,#c99a4a 40%,#7a5418 70%,#e8c27a)',
          boxShadow: `0 10px 26px -8px rgba(0,0,0,.8), 0 0 22px -6px ${t.accent}`,
        }}
      >
        <div className="relative size-full overflow-hidden rounded-[8%/6%] bg-black">
          <RoleEmblem role={role} className={cn('size-full', dead && 'grayscale')} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-[6%] pt-[14%]">
            <span
              className={cn('font-display leading-none whitespace-nowrap text-gold-grad', size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xl' : 'text-3xl')}
            >
              {roleLabel(role)}
            </span>
            {size === 'lg' && <span className="mt-1 text-[11px] text-[#f3ead6]/75">{ROLE_TAGLINE[role]}</span>}
          </div>
          {/* 内边框 */}
          <div className="pointer-events-none absolute inset-[3%] rounded-[6%/4.5%] border border-[#f6dca0]/40" />
        </div>
      </div>
    </div>
  )
}
