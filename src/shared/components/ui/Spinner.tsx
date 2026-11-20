import { LoaderCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-2 text-sm text-ink-soft', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function FullPageLoader({ label = 'Preparando Rivo' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6">
      <div className="relative flex size-16 items-center justify-center rounded-2xl bg-brand-900 shadow-float">
        <LoaderCircle className="size-7 animate-spin text-sun-300" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink-soft">{label}…</p>
    </div>
  )
}

export function InlineLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  )
}
