import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/cn'

export function ErrorState({
  title = 'No pudimos cargar esto',
  description = 'Puede ser un problema de conexión. Intenta de nuevo.',
  onRetry,
  action,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-10 text-center', className)} role="alert">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-berry-50 text-berry-600">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
            Reintentar
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
