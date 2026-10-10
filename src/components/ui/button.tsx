import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        gold:
          "border-[#7a5418] bg-[linear-gradient(180deg,#ffe9b0_0%,#f0c46c_45%,#c98e33_100%)] text-[#3a2305] font-display font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(120,70,10,0.45),0_6px_16px_-6px_rgba(232,180,90,0.7)] hover:brightness-110 active:translate-y-0.5 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_8px_-4px_rgba(232,180,90,0.7)]",
        blood:
          "border-[#5a1010] bg-[linear-gradient(180deg,#ff8a7a_0%,#d23c3c_50%,#8e1c1c_100%)] text-white font-display font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(80,0,0,0.45),0_6px_16px_-6px_rgba(210,60,60,0.8)] hover:brightness-110 active:translate-y-0.5",
        mystic:
          "border-[#3b1d7a] bg-[linear-gradient(180deg,#c4b5fd_0%,#8b5cf6_50%,#5b21b6_100%)] text-white font-display font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(40,10,90,0.45),0_6px_16px_-6px_rgba(139,92,246,0.8)] hover:brightness-110 active:translate-y-0.5",
        moss:
          "border-[#11402a] bg-[linear-gradient(180deg,#a7f3d0_0%,#3fae7a_50%,#1e6b48_100%)] text-white font-display font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(10,50,30,0.45),0_6px_16px_-6px_rgba(63,174,122,0.8)] hover:brightness-110 active:translate-y-0.5",
        stone:
          "border-[#e8b45a]/40 bg-[linear-gradient(180deg,#2c3566_0%,#1b2247_100%)] text-[#f3ead6] font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_-6px_rgba(0,0,0,0.8)] hover:brightness-125 active:translate-y-0.5",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        xl: "h-12 gap-2 rounded-xl px-6 text-lg tracking-widest [&_svg:not([class*='size-'])]:size-5",
        lg2: "h-10 gap-1.5 rounded-xl px-4 text-base tracking-wide",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
