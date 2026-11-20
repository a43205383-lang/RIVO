import { supabase } from '@/shared/lib/supabase'
import type { PreparedCapture, ProcessedReceipt, UploadProgress } from '@/features/capture/types'
import { extractReceipt, ExtractionError } from '@/features/extraction/api/extractionApi'
import { mapExtractionToExpense } from '@/features/extraction/lib/mapExtractionToExpense'
import { getExpense, replaceExpenseItems, updateExpense } from '@/features/expenses/api/expensesApi'
import { errorMessage } from '@/shared/lib/errors'
import { getAccessToken, uploadWithProgress } from '@/features/capture/api/uploadWithProgress'

const MAX_IMAGES_FOR_AI = 5

function extensionFor(type: string): string {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

async function ensureExpense(expenseId: string, userId: string) {
  const { data, error } = await supabase.from('expenses').select('id').eq('id', expenseId).maybeSingle()
  if (error) throw new Error(errorMessage(error, 'No pudimos preparar el gasto.'))
  if (data) return
  const { error: insertError } = await supabase.from('expenses').insert({
    id: expenseId,
    user_id: userId,
    status: 'draft',
    currency: 'DOP',
    category: 'otros',
  })
  if (insertError && insertError.code !== '23505') {
    throw new Error(errorMessage(insertError, 'No pudimos crear el gasto.'))
  }
}

export interface ProcessReceiptParams {
  userId: string
  files: PreparedCapture[]
  expenseId?: string
  onProgress?: (progress: UploadProgress) => void
}

export async function processReceiptSet({
  userId,
  files,
  expenseId = crypto.randomUUID(),
  onProgress,
}: ProcessReceiptParams): Promise<ProcessedReceipt> {
  if (files.length === 0) throw new Error('Agrega al menos una foto del recibo.')

  const token = await getAccessToken()
  const totalBytes = files.reduce((sum, file) => sum + file.blob.size + (file.thumbBlob?.size ?? 0), 0) || 1
  let uploadedBytes = 0

  const report = (percent: number, label: string) => onProgress?.({ percent, label })

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const extension = extensionFor(file.type)
    const mainPath = `${userId}/${expenseId}/${file.id}.${extension}`
    const thumbPath = file.thumbBlob ? `${userId}/${expenseId}/${file.id}-thumb.jpg` : null

    report(2 + (uploadedBytes / totalBytes) * 78, `Subiendo recibo ${index + 1} de ${files.length}`)

    await uploadWithProgress({
      path: mainPath,
      blob: file.blob,
      accessToken: token,
      onProgress: (loaded) => {
        report(2 + ((uploadedBytes + Math.min(loaded, file.blob.size)) / totalBytes) * 78, `Subiendo recibo ${index + 1} de ${files.length}`)
      },
    })
    uploadedBytes += file.blob.size

    if (thumbPath && file.thumbBlob) {
      await uploadWithProgress({
        path: thumbPath,
        blob: file.thumbBlob,
        accessToken: token,
        onProgress: (loaded) => {
          report(
            2 + ((uploadedBytes + Math.min(loaded, file.thumbBlob?.size ?? 0)) / totalBytes) * 78,
            `Optimizando recibo ${index + 1} de ${files.length}`,
          )
        },
      })
      uploadedBytes += file.thumbBlob.size
    }
  }

  report(83, 'Guardando el gasto')
  await ensureExpense(expenseId, userId)

  const imageRows = files.map((file, index) => {
    const extension = extensionFor(file.type)
    return {
      id: file.id,
      expense_id: expenseId,
      storage_path: `${userId}/${expenseId}/${file.id}.${extension}`,
      thumb_path: file.thumbBlob ? `${userId}/${expenseId}/${file.id}-thumb.jpg` : null,
      mime_type: file.type,
      size_bytes: file.blob.size,
      width: file.width,
      height: file.height,
      image_hash: file.hash,
      position: index,
    }
  })

  const { error: imagesError } = await supabase.from('expense_images').upsert(imageRows, { onConflict: 'id' })
  if (imagesError) throw new Error(errorMessage(imagesError, 'No pudimos guardar las fotos del recibo.'))

  const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, MAX_IMAGES_FOR_AI)
  let extractionError: string | null = null
  const usedPdfOnly = imageFiles.length === 0

  if (usedPdfOnly) {
    await updateExpense(expenseId, {
      status: 'needs_review',
      review_reason: 'pdf_manual',
      ai_notes: 'El PDF quedó adjunto. Completa los datos manualmente para confirmarlo.',
    })
    report(100, 'Listo para revisar')
    return { expenseId, extractionError: null, usedPdfOnly }
  }

  report(90, 'Analizando el recibo con IA')
  try {
    const result = await extractReceipt(imageFiles.map((file) => `${userId}/${expenseId}/${file.id}.${extensionFor(file.type)}`))
    const mapping = mapExtractionToExpense(result.data)
    await updateExpense(expenseId, mapping.patch)
    await replaceExpenseItems(expenseId, mapping.items)
  } catch (caught) {
    extractionError =
      caught instanceof ExtractionError
        ? caught.message
        : errorMessage(caught, 'No pudimos analizar el recibo con IA. Puedes completarlo a mano.')
    await updateExpense(expenseId, {
      status: 'needs_review',
      review_reason: 'extraction_failed',
      ai_notes: extractionError,
    }).catch(() => undefined)
  }

  report(100, 'Listo para revisar')
  return { expenseId, extractionError, usedPdfOnly }
}

export async function reanalyzeExpense(expenseId: string, _userId: string) {
  const expense = await getExpense(expenseId)
  const paths = expense.images
    .filter((image) => image.mime_type.startsWith('image/'))
    .slice(0, MAX_IMAGES_FOR_AI)
    .map((image) => image.storage_path)
  if (paths.length === 0) throw new Error('Este gasto no tiene imágenes para analizar.')
  const result = await extractReceipt(paths)
  const mapping = mapExtractionToExpense(result.data)
  await updateExpense(expenseId, mapping.patch)
  await replaceExpenseItems(expenseId, mapping.items)
  return mapping
}

export { ensureExpense }
