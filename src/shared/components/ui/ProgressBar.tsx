import { cn } from '@/shared/lib/cn'

export function ProgressBar({
  value,
  label,
  detail,
  className,
  tone = 'brand',
}: {
  value: number
  label?: string
  detail?: string
  className?: string
  tone?: 'brand' | 'sun'
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || detail) && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-ink-soft">{label}</span>
          <span className="tabular text-ink-faint">{detail ?? `${clamped}%`}</span>
        </div>
      )}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-canvas-deep"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label ?? 'Progreso'}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out',
            tone === 'brand' ? 'bg-gradient-to-r from-brand-500 to-brand-700' : 'bg-gradient-to-r from-sun-300 to-sun-500',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
