import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Tone = 'neutral' | 'brand' | 'sun' | 'berry' | 'sky' | 'outline' | 'dark'

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas-deep text-ink-soft',
  brand: 'bg-brand-100 text-brand-800',
  sun: 'bg-sun-100 text-sun-700',
  berry: 'bg-berry-100 text-berry-700',
  sky: 'bg-sky-100 text-sky-700',
  outline: 'border border-line-strong bg-transparent text-ink-soft',
  dark: 'bg-brand-950 text-white',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
