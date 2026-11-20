import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraErrorCode = 'denied' | 'unavailable' | 'unsupported' | 'insecure' | 'unknown'

export interface CameraError {
  code: CameraErrorCode
  message: string
}

function mapCameraError(error: unknown): CameraError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return {
        code: 'denied',
        message:
          'No diste permiso para usar la cámara. Puedes elegir una foto de tu galería o habilitar el permiso en los ajustes del navegador.',
      }
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return {
        code: 'unavailable',
        message: 'No encontramos una cámara disponible. Puedes subir una foto desde la galería.',
      }
    }
    if (error.name === 'NotReadableError' || error.name === 'AbortError') {
      return {
        code: 'unknown',
        message: 'La cámara está siendo usada por otra aplicación. Cierra esa app e intenta de nuevo.',
      }
    }
  }
  return {
    code: 'unknown',
    message: 'No pudimos abrir la cámara. Puedes usar la galería mientras tanto.',
  }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<CameraError | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
    setStarting(false)
  }, [])

  const start = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      setError(null)
      if (!window.isSecureContext) {
        setError({
          code: 'insecure',
          message:
            'La cámara necesita HTTPS (o localhost). Publica la app o usa la galería para elegir una foto.',
        })
        return false
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({
          code: 'unsupported',
          message: 'Este navegador no permite abrir la cámara desde la web. Usa la galería.',
        })
        return false
      }

      setStarting(true)
      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          })
        } catch (firstError) {
          if (firstError instanceof DOMException && firstError.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          } else {
            throw firstError
          }
        }
        streamRef.current = stream
        setFacingMode(mode)
        setActive(true)
        return true
      } catch (caught) {
        setError(mapCameraError(caught))
        setActive(false)
        return false
      } finally {
        setStarting(false)
      }
    },
    [facingMode],
  )

  const flip = useCallback(async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    stop()
    return start(next)
  }, [facingMode, start, stop])

  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('La cámara aún no está lista. Espera un segundo e intenta de nuevo.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('No pudimos capturar la foto.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('No pudimos capturar la foto.'))),
        'image/jpeg',
        0.92,
      )
    })
    return blob
  }, [])

  useEffect(() => {
    if (!active || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    void video.play().catch(() => {
      setError({
        code: 'unknown',
        message: 'Toca el video para iniciar la cámara.',
      })
    })
  }, [active])

  useEffect(() => () => stop(), [stop])

  return { videoRef, active, starting, error, facingMode, start, stop, flip, capture, setError }
}
