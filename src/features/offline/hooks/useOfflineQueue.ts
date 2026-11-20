import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { countQueuedCaptures } from '@/features/offline/lib/captureQueue'
import { processOfflineQueue } from '@/features/offline/lib/processQueue'
import { useToast } from '@/shared/components/ui/Toast'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'

export function useOfflineQueue() {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [count, setCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const lastAttemptRef = useRef(0)

  const refreshCount = useCallback(async () => {
    if (!user) {
      setCount(0)
      return
    }
    try {
      setCount(await countQueuedCaptures(user.id))
    } catch {
      setCount(0)
    }
  }, [user])

  useEffect(() => {
    void refreshCount()
    const handleChange = () => void refreshCount()
    window.addEventListener('rivo:queue-changed', handleChange)
    return () => window.removeEventListener('rivo:queue-changed', handleChange)
  }, [refreshCount])

  const process = useCallback(async () => {
    if (!user || !online || processing) return
    lastAttemptRef.current = Date.now()
    setProcessing(true)
    try {
      const result = await processOfflineQueue(user.id)
      if (result.processed.length > 0) {
        toast.success(
          result.processed.length === 1
            ? 'Recibo en cola procesado. Revísalo en Gastos.'
            : `${result.processed.length} recibos de la cola procesados. Revísalos en Gastos.`,
        )
      }
      if (result.errors.length > 0) {
        toast.error(result.errors[0])
      }
    } finally {
      setProcessing(false)
      void refreshCount()
    }
  }, [user, online, processing, toast, refreshCount])

  useEffect(() => {
    if (!user || !online || count === 0 || processing) return
    // Evita un bucle de reintentos si el servidor sigue fallando.
    if (Date.now() - lastAttemptRef.current < 30_000) return
    void process()
  }, [user, online, count, processing, process])

  useEffect(() => {
    const handleOnline = () => {
      lastAttemptRef.current = 0
      void process()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [process])

  return { count, processing, refresh: refreshCount, process }
}
