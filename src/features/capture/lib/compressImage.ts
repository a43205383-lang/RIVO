import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, MAX_PDF_BYTES, type PreparedCapture } from '@/features/capture/types'

function extensionFor(type: string, fallback: string): string {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return fallback
}

function pickMime(): string {
  // Receipts do not need transparency, and JPEG gives us reliable size control.
  return 'image/jpeg'
}

async function sha256Hex(blob: Blob): Promise<string> {
  try {
    const buffer = await blob.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    // crypto.subtle requires a secure context. FNV-1a keeps duplicate detection useful in LAN dev.
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let hash = 0x811c9dc5
    for (const byte of bytes) {
      hash ^= byte
      hash = Math.imul(hash, 0x01000193)
    }
    return `fnv-${(hash >>> 0).toString(16)}`
  }
}

async function decodeImage(blob: Blob): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Safari/HEIC paths can reject createImageBitmap; fall back to <img>.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('No pudimos leer la imagen. Usa JPG, PNG o WebP.'))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No pudimos comprimir la imagen.'))),
      type,
      quality,
    )
  })
}

function drawResized(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSide: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Tu navegador no puede procesar imágenes.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, targetWidth, targetHeight)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, targetWidth, targetHeight)
  return { canvas, width: targetWidth, height: targetHeight }
}

export async function prepareCapture(file: File | Blob, name = 'recibo.jpg'): Promise<PreparedCapture> {
  const type = file.type || 'application/octet-stream'

  if (type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('El PDF supera 5 MB. Comprime el archivo o sube fotos del recibo.')
    }
    return {
      id: crypto.randomUUID(),
      name,
      type,
      blob: file,
      thumbBlob: null,
      width: null,
      height: null,
      hash: await sha256Hex(file),
    }
  }

  if (!type.startsWith('image/')) {
    throw new Error('Formato no compatible. Usa JPG, PNG, WebP o PDF.')
  }

  const decoded = await decodeImage(file)
  try {
    if (!decoded.width || !decoded.height) throw new Error('La imagen está vacía o dañada.')

    const mime = pickMime()
    const attempts: Array<{ maxSide: number; quality: number }> = [
      { maxSide: MAX_IMAGE_SIDE, quality: 0.86 },
      { maxSide: MAX_IMAGE_SIDE, quality: 0.74 },
      { maxSide: MAX_IMAGE_SIDE, quality: 0.62 },
      { maxSide: 1400, quality: 0.7 },
      { maxSide: 1200, quality: 0.62 },
      { maxSide: 1000, quality: 0.58 },
      { maxSide: 800, quality: 0.55 },
    ]

    let best: { blob: Blob; width: number; height: number } | null = null
    for (const attempt of attempts) {
      const rendered = drawResized(decoded.source, decoded.width, decoded.height, attempt.maxSide)
      const blob = await canvasToBlob(rendered.canvas, mime, attempt.quality)
      best = { blob, width: rendered.width, height: rendered.height }
      if (blob.size <= MAX_IMAGE_BYTES) break
    }

    if (!best) throw new Error('No pudimos comprimir la imagen.')
    if (best.blob.size > MAX_IMAGE_BYTES) {
      throw new Error('No pudimos reducir la imagen a 1.5 MB. Intenta con mejor luz o recorta el recibo.')
    }

    const thumbRendered = drawResized(decoded.source, decoded.width, decoded.height, 420)
    const thumbBlob = await canvasToBlob(thumbRendered.canvas, mime, 0.68)

    return {
      id: crypto.randomUUID(),
      name: `${name.replace(/\.[^.]+$/, '') || 'recibo'}.${extensionFor(mime, 'jpg')}`,
      type: mime,
      blob: best.blob,
      thumbBlob,
      width: best.width,
      height: best.height,
      hash: await sha256Hex(best.blob),
    }
  } finally {
    decoded.close()
  }
}

export function createFileFromCamera(blob: Blob): File {
  return new File([blob], `recibo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
}
