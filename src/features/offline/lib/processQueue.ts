import { processReceiptSet } from '@/features/capture/api/processReceipt'
import { deleteQueuedCapture, listQueuedCaptures, notifyQueueChanged } from '@/features/offline/lib/captureQueue'
import { errorMessage } from '@/shared/lib/errors'

let processing = false

export interface OfflineQueueResult {
  processed: string[]
  errors: string[]
}

export async function processOfflineQueue(userId: string): Promise<OfflineQueueResult> {
  if (processing || !navigator.onLine) return { processed: [], errors: [] }
  processing = true
  const result: OfflineQueueResult = { processed: [], errors: [] }

  try {
    const items = await listQueuedCaptures(userId)
    for (const item of items) {
      if (!navigator.onLine) break
      try {
        const processed = await processReceiptSet({
          userId,
          files: item.files,
          // Stable ID makes uploads and database writes safe to retry after a partial failure.
          expenseId: item.id,
        })
        await deleteQueuedCapture(item.id)
        result.processed.push(processed.expenseId)
      } catch (error) {
        result.errors.push(errorMessage(error, 'No pudimos procesar un recibo en cola.'))
        break
      }
    }
  } finally {
    processing = false
    notifyQueueChanged()
    if (result.processed.length > 0) {
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
    }
  }

  return result
}
