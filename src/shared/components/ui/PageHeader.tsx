import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backTo,
  backLabel = 'Volver',
  className,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}) {
  return (
    <header className={cn('mb-5 sm:mb-6', className)}>
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-soft transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
          )}
          <h1 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-3xl">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
