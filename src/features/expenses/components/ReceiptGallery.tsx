import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ImageOff,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { getSignedUrl } from '@/features/expenses/api/storageApi'
import { cn } from '@/shared/lib/cn'
import type { ExpenseImageRow } from '@/shared/types/database.types'

export function ReceiptGallery({
  images,
  urls,
  className,
  compact = false,
}: {
  images: ExpenseImageRow[]
  urls: Record<string, string>
  className?: string
  compact?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (activeIndex >= images.length) setActiveIndex(0)
  }, [images.length, activeIndex])

  const current = images[activeIndex]
  const currentUrl = current ? urls[current.storage_path] : null

  useEffect(() => {
    if (!current || current.mime_type !== 'application/pdf') {
      setPdfUrl(null)
      return
    }
    let active = true
    getSignedUrl(current.storage_path).then((url) => {
      if (active) setPdfUrl(url)
    })
    return () => {
      active = false
    }
  }, [current])

  if (!current) {
    return (
      <div
        className={cn(
          'flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-canvas/60 text-ink-faint',
          className,
        )}
      >
        <ImageOff className="size-8" aria-hidden />
        <p className="text-xs">Sin imagen adjunta</p>
      </div>
    )
  }

  const thumbUrl = (image: ExpenseImageRow) => urls[image.thumb_path ?? ''] ?? urls[image.storage_path] ?? null
  const isPdf = current.mime_type === 'application/pdf'

  return (
    <div className={cn('space-y-2.5', className)}>
      {isPdf ? (
        <div className={cn('relative flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-canvas-deep p-6 text-center', compact && 'aspect-square')}>
          <FileText className="size-12 text-berry-500" aria-hidden />
          <div>
            <p className="text-sm font-bold text-ink">Recibo en PDF</p>
            <p className="mt-1 text-xs text-ink-soft">La IA no analiza PDF; revisa los datos manualmente.</p>
          </div>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-canvas"
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir PDF
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className={cn(
            'group relative block w-full overflow-hidden rounded-2xl border border-line bg-brand-950/5',
            compact ? 'aspect-square' : 'max-h-[62vh]',
          )}
          aria-label="Ampliar imagen del recibo"
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Recibo original"
              className={cn('w-full object-contain', compact ? 'h-full' : 'max-h-[62vh]')}
            />
          ) : (
            <span className="flex aspect-[4/5] flex-col items-center justify-center gap-2 text-ink-faint">
              <ImageOff className="size-8" aria-hidden />
              <span className="text-xs">No pudimos cargar la imagen</span>
            </span>
          )}
          <span className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-brand-950/70 text-white opacity-90 backdrop-blur transition group-hover:bg-brand-950">
            <Maximize2 className="size-4" aria-hidden />
          </span>
        </button>
      )}

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {images.map((image, index) => {
            const url = thumbUrl(image)
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                  index === activeIndex ? 'border-brand-600' : 'border-transparent opacity-65 hover:opacity-100',
                )}
                aria-label={`Ver imagen ${index + 1} de ${images.length}`}
                aria-current={index === activeIndex}
              >
                {image.mime_type === 'application/pdf' ? (
                  <span className="flex size-full items-center justify-center bg-canvas-deep text-berry-500">
                    <FileText className="size-5" aria-hidden />
                  </span>
                ) : url ? (
                  <img src={url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-canvas-deep text-ink-faint">
                    <ImageOff className="size-4" aria-hidden />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!isPdf && lightboxOpen && currentUrl && (
        <ImageLightbox
          src={currentUrl}
          count={images.length}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={images.length > 1 ? () => setActiveIndex((index) => (index - 1 + images.length) % images.length) : undefined}
          onNext={images.length > 1 ? () => setActiveIndex((index) => (index + 1) % images.length) : undefined}
        />
      )}
    </div>
  )
}

function ImageLightbox({
  src,
  index,
  count,
  onClose,
  onPrev,
  onNext,
}: {
  src: string
  index: number
  count: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const originalOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(value + 0.5, 4))
      if (event.key === '-') setZoom((value) => Math.max(value - 0.5, 1))
      if (event.key === 'ArrowLeft') onPrev?.()
      if (event.key === 'ArrowRight') onNext?.()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.documentElement.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, onPrev, onNext])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-brand-950/97" role="dialog" aria-modal="true" aria-label="Recibo ampliado">
      <div className="safe-top flex items-center justify-between px-4 py-2 text-white">
        <span className="text-xs font-semibold text-white/60">
          Imagen {index + 1} de {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Cerrar imagen"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-3 sm:p-8">
        <img
          src={src}
          alt="Recibo original ampliado"
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none' }}
          className="h-auto rounded-lg object-contain"
        />
      </div>

      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Imagen anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Imagen siguiente"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      <div className="safe-bottom flex items-center justify-center gap-2 pb-3">
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
          disabled={zoom <= 1}
          aria-label="Reducir zoom"
        >
          <Minus className="size-5" />
        </button>
        <span className="min-w-12 text-center text-sm font-bold tabular text-white">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
          disabled={zoom >= 4}
          aria-label="Aumentar zoom"
        >
          <Plus className="size-5" />
        </button>
        {zoom > 1 && (
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="ml-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            Ajustar
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
