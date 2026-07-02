import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/lib/utils'

// Vendored from shadcn base registry (bubble), adapted for Tailwind v3 and this
// app's HSL theme tokens: upstream styles variants via v4 `*:data-[slot]` child
// selectors and oklch/color-mix (which need v4 + oklch tokens); here the variant
// colors live on BubbleContent via group-data selectors instead. Interactive
// (button/a) hover variants dropped — bubbles are display-only in this app.
function BubbleGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  )
}

const bubbleVariants = cva(
  'group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        muted: '',
        tinted: '',
        outline: '',
        ghost: '',
        destructive: ''
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Bubble({
  variant = 'default',
  align = 'start',
  className,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof bubbleVariants> & {
    align?: 'start' | 'end'
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  )
}

function BubbleContent({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot="bubble-content"
      className={cn(
        'w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed break-words group-data-[align=end]/bubble:self-end',
        'group-data-[variant=default]/bubble:bg-primary group-data-[variant=default]/bubble:text-primary-foreground',
        'group-data-[variant=secondary]/bubble:bg-secondary group-data-[variant=secondary]/bubble:text-secondary-foreground',
        'group-data-[variant=muted]/bubble:bg-muted',
        'group-data-[variant=tinted]/bubble:bg-blue-500/10 group-data-[variant=tinted]/bubble:text-foreground',
        'group-data-[variant=outline]/bubble:border-border group-data-[variant=outline]/bubble:bg-background',
        'group-data-[variant=ghost]/bubble:rounded-none group-data-[variant=ghost]/bubble:bg-transparent group-data-[variant=ghost]/bubble:p-0',
        'group-data-[variant=destructive]/bubble:bg-destructive/10 group-data-[variant=destructive]/bubble:text-destructive',
        className
      )}
      {...props}
    />
  )
}

const bubbleReactionsVariants = cva(
  'absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring ring-card has-[button]:p-0',
  {
    variants: {
      side: {
        top: 'top-0 -translate-y-3/4',
        bottom: 'bottom-0 translate-y-3/4'
      },
      align: {
        start: 'left-3',
        end: 'right-3'
      }
    },
    defaultVariants: {
      side: 'bottom',
      align: 'end'
    }
  }
)

function BubbleReactions({
  side = 'bottom',
  align = 'end',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  )
}

export { BubbleGroup, Bubble, BubbleContent, BubbleReactions }
