import { CloudOff, LoaderCircle, RefreshCw, Wifi } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'

export function OfflineBanner({
  online,
  queueCount,
  processing,
  onRetry,
}: {
  online: boolean
  queueCount: number
  processing: boolean
  onRetry: () => void
}) {
  if (online && queueCount === 0 && !processing) return null

  if (!online) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sun-200 bg-sun-50 px-3.5 py-3 text-sun-800" role="status">
        <CloudOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Estás sin conexión</p>
          <p className="mt-0.5 text-xs leading-relaxed text-sun-700">
            Puedes ver los gastos ya cargados y capturar recibos. Se guardarán en este dispositivo
            {queueCount > 0 ? ` (${queueCount} en cola)` : ''} y se procesarán al volver la red.
          </p>
        </div>
        {queueCount > 0 && (
          <span className="rounded-full bg-sun-200 px-2 py-0.5 text-xs font-bold text-sun-800">{queueCount}</span>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-brand-800" role="status">
      {processing ? (
        <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Wifi className="size-5 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {processing ? 'Procesando recibos guardados…' : `${queueCount} recibo${queueCount === 1 ? '' : 's'} en cola`}
        </p>
        <p className="mt-0.5 text-xs text-brand-700">
          {processing ? 'Subiendo imágenes y extrayendo datos con IA.' : 'Ya hay conexión. Puedes procesarlos ahora.'}
        </p>
      </div>
      {!processing && (
        <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Procesar
        </Button>
      )}
    </div>
  )
}
