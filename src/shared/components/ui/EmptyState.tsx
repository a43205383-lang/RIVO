import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
