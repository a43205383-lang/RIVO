import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  FileText,
  ImagePlus,
  RotateCcw,
  ScanLine,
  Trash2,
  VideoOff,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useCamera } from '@/features/capture/hooks/useCamera'
import { prepareCapture } from '@/features/capture/lib/compressImage'
import { processReceiptSet } from '@/features/capture/api/processReceipt'
import { enqueueCapture } from '@/features/offline/lib/captureQueue'
import { useOfflineQueue } from '@/features/offline/hooks/useOfflineQueue'
import type { CaptureDraft, PreparedCapture, UploadProgress } from '@/features/capture/types'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { ProgressBar } from '@/shared/components/ui/ProgressBar'
import { useToast } from '@/shared/components/ui/Toast'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { env } from '@/shared/lib/env'
import { errorMessage } from '@/shared/lib/errors'
import { cn } from '@/shared/lib/cn'

function toPrepared(draft: CaptureDraft): PreparedCapture {
  return {
    id: draft.id,
    name: draft.name,
    type: draft.type,
    blob: draft.blob,
    thumbBlob: draft.thumbBlob,
    width: draft.width,
    height: draft.height,
    hash: draft.hash,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CapturePage() {
  useDocumentTitle('Escanear recibo')
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const online = useOnlineStatus()
  const queue = useOfflineQueue()
  const camera = useCamera()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [drafts, setDrafts] = useState<CaptureDraft[]>([])
  const draftsRef = useRef<CaptureDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>({ percent: 0, label: '' })

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(
    () => () => {
      draftsRef.current.forEach((draft) => {
        URL.revokeObjectURL(draft.previewUrl)
        if (draft.thumbUrl) URL.revokeObjectURL(draft.thumbUrl)
      })
    },
    [],
  )

  const append = (prepared: PreparedCapture, source: CaptureDraft['source']): boolean => {
    const current = draftsRef.current
    if (current.length >= env.maxImagesPerExpense) {
      setError(`Puedes adjuntar hasta ${env.maxImagesPerExpense} recibos por gasto.`)
      return false
    }
    if (current.some((draft) => draft.hash === prepared.hash)) {
      setError('Este recibo ya está en la lista.')
      return false
    }
    const draft: CaptureDraft = {
      ...prepared,
      previewUrl: URL.createObjectURL(prepared.blob),
      thumbUrl: prepared.thumbBlob ? URL.createObjectURL(prepared.thumbBlob) : null,
      source,
    }
    const next = [...current, draft]
    draftsRef.current = next
    setDrafts(next)
    setError(null)
    return true
  }

  const handleFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return
    setPreparing(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const prepared = await prepareCapture(file, file.name)
        append(prepared, 'gallery')
      }
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos preparar la imagen.'))
    } finally {
      setPreparing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCapture = async () => {
    setError(null)
    try {
      const blob = await camera.capture()
      const prepared = await prepareCapture(blob, `recibo-${Date.now()}.jpg`)
      append(prepared, 'camera')
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos capturar la foto.'))
    }
  }

  const removeDraft = (id: string) => {
    const draft = draftsRef.current.find((item) => item.id === id)
    if (draft) {
      URL.revokeObjectURL(draft.previewUrl)
      if (draft.thumbUrl) URL.revokeObjectURL(draft.thumbUrl)
    }
    const next = draftsRef.current.filter((item) => item.id !== id)
    draftsRef.current = next
    setDrafts(next)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!user) return
    if (drafts.length === 0) {
      setError('Agrega al menos una foto del recibo.')
      return
    }
    setError(null)
    setProcessing(true)
    setProgress({ percent: 2, label: 'Preparando los recibos' })
    try {
      const files = drafts.map(toPrepared)
      if (!online) {
        await enqueueCapture(user.id, files)
        toast.info('Recibos guardados en el dispositivo. Se subirán cuando vuelva la conexión.')
        navigate('/expenses')
        return
      }
      const result = await processReceiptSet({ userId: user.id, files, onProgress: setProgress })
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
      toast.success(
        result.extractionError
          ? 'Recibo guardado. Completa o revisa los datos extraídos.'
          : 'Recibo analizado y guardado. Revísalo antes de confirmarlo.',
      )
      navigate(`/expenses/${result.expenseId}/review`)
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos procesar el recibo. Intenta de nuevo.'))
    } finally {
      setProcessing(false)
    }
  }

  const canSubmit = drafts.length > 0 && !processing && !preparing

  return (
    <div className="bottom-nav-space mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
      <PageHeader
        eyebrow="Nuevo gasto"
        title="Escanear recibo"
        description="Toma una foto o elige imágenes de tu galería. Rivo extrae los datos con IA y guarda el original de forma privada."
        backTo="/expenses"
        backLabel="Volver a gastos"
      />

      {!online && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-3 text-sm font-medium text-sun-700">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Estás sin conexión. Los recibos se guardarán en este dispositivo y se subirán automáticamente al
            volver a estar en línea.
            {queue.count > 0 && ` Hay ${queue.count} en la cola.`}
          </p>
        </div>
      )}

      <section className="card overflow-hidden" aria-label="Cámara y galería">
        <div className="relative aspect-[4/3] w-full bg-brand-950 sm:aspect-video">
          <video
            ref={camera.videoRef}
            playsInline
            muted
            className={cn('size-full object-cover', camera.active ? 'block' : 'hidden')}
          />
          {!camera.active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
              <ScanLine className="size-12 text-brand-300" aria-hidden />
              <p className="max-w-xs text-sm leading-relaxed">
                Apunta la cámara al recibo con buena luz, o elige varias fotos desde tu galería.
              </p>
              <Button
                variant="sun"
                icon={<Camera className="size-4" />}
                onClick={() => void camera.start()}
                disabled={camera.starting || processing}
                loading={camera.starting}
              >
                Abrir cámara
              </Button>
            </div>
          )}
          {camera.active && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-brand-950/80 to-transparent p-4">
              <Button
                variant="dark"
                size="icon"
                icon={<RotateCcw className="size-5" />}
                onClick={() => void camera.flip()}
                aria-label="Cambiar cámara"
              />
              <Button
                variant="sun"
                size="lg"
                icon={<Camera className="size-5" />}
                onClick={() => void handleCapture()}
                disabled={preparing || processing}
              >
                Tomar foto
              </Button>
              <Button
                variant="dark"
                size="icon"
                icon={<VideoOff className="size-5" />}
                onClick={camera.stop}
                aria-label="Cerrar cámara"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs font-medium text-ink-faint">
            Hasta {env.maxImagesPerExpense} imágenes por gasto · JPG, PNG, WebP o PDF
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files ?? [])}
            aria-label="Elegir recibos desde la galería"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<ImagePlus className="size-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={preparing || processing || drafts.length >= env.maxImagesPerExpense}
          >
            Elegir de la galería
          </Button>
        </div>
      </section>

      {(camera.error || error) && (
        <div className="mt-4 rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-3 text-sm font-medium text-berry-700" role="alert">
          {error ?? camera.error?.message}
        </div>
      )}

      <section className="mt-5" aria-label="Recibos seleccionados">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Recibos seleccionados</h2>
          <span className="tabular text-xs font-semibold text-ink-faint">
            {drafts.length}/{env.maxImagesPerExpense}
          </span>
        </div>
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-8 text-center text-sm text-ink-faint">
            Aún no hay recibos. Usa la cámara o la galería para agregar el primero.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drafts.map((draft) => (
              <li key={draft.id} className="card relative overflow-hidden">
                <div className="flex aspect-[4/3] items-center justify-center bg-canvas-deep">
                  {draft.type === 'application/pdf' ? (
                    <div className="flex flex-col items-center gap-1 text-berry-600">
                      <FileText className="size-9" aria-hidden />
                      <span className="text-[0.6875rem] font-semibold">PDF</span>
                    </div>
                  ) : (
                    <img src={draft.thumbUrl ?? draft.previewUrl} alt={draft.name} className="size-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{draft.name}</p>
                    <p className="text-[0.6875rem] text-ink-faint">
                      {formatBytes(draft.blob.size)} · {draft.source === 'camera' ? 'Cámara' : 'Galería'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.id)}
                    className="shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-berry-50 hover:text-berry-600"
                    aria-label={`Quitar ${draft.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {processing && (
        <div className="card mt-5 p-4">
          <ProgressBar value={progress.percent} label={progress.label || 'Procesando'} />
          <p className="mt-2 text-xs text-ink-faint">No cierres la app hasta que termine.</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          icon={<ScanLine className="size-5" />}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={processing}
          className="flex-1 sm:flex-none"
        >
          {online ? 'Analizar y guardar' : 'Guardar para subir después'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/expenses')}
          disabled={processing}
        >
          Cancelar
        </Button>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
        Después del análisis podrás revisar, corregir y confirmar el gasto antes de enviarlo a contabilidad.
      </p>
    </div>
  )
}
