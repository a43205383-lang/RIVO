import { Download, Share, Smartphone } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { useInstallPrompt } from '@/features/pwa/hooks/useInstallPrompt'

export function InstallCard({ compact = false }: { compact?: boolean }) {
  const { canInstall, installed, isIOS, install } = useInstallPrompt()

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5">
        <Smartphone className="size-5 text-brand-700" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-brand-800">App instalada</p>
          <p className="text-xs text-brand-700">Rivo está abierta en modo standalone.</p>
        </div>
      </div>
    )
  }

  if (!canInstall && !isIOS) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-canvas/60 px-4 py-3.5">
        <Download className="mt-0.5 size-5 text-ink-soft" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-ink">Instalar Rivo</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            Abre el menú del navegador y elige «Agregar a pantalla de inicio» o «Instalar aplicación».
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-sun-200 bg-sun-50 p-4">
      <div className="flex items-start gap-3">
        {isIOS ? (
          <Share className="mt-0.5 size-5 shrink-0 text-sun-700" aria-hidden />
        ) : (
          <Download className="mt-0.5 size-5 shrink-0 text-sun-700" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sun-800">Lleva Rivo a tu pantalla de inicio</p>
          <p className="mt-0.5 text-xs leading-relaxed text-sun-700">
            {isIOS
              ? 'En Safari, toca Compartir → Agregar a pantalla de inicio.'
              : 'Instálala para abrirla en modo standalone y capturar recibos más rápido.'}
          </p>
        </div>
      </div>
      {!isIOS && (
        <Button
          className="mt-3 w-full"
          size={compact ? 'sm' : 'md'}
          variant="primary"
          icon={<Download className="size-4" />}
          onClick={() => void install()}
        >
          Instalar app
        </Button>
      )}
    </div>
  )
}
