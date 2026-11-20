import { parseReceiptExtraction, type ReceiptExtraction } from '@/features/extraction/schemas'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

export class ExtractionError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'unknown', status = 0) {
    super(message)
    this.name = 'ExtractionError'
    this.code = code
    this.status = status
  }
}

export interface ExtractionResult {
  data: ReceiptExtraction
  meta?: {
    model?: string
    retryCount?: number
    remaining?: number | null
  }
}

export async function extractReceipt(imagePaths: string[]): Promise<ExtractionResult> {
  if (imagePaths.length === 0) throw new ExtractionError('No hay imágenes para analizar.', 'no_images')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ExtractionError('Tu sesión venció. Vuelve a iniciar sesión.', 'no_session', 401)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 95_000)

  try {
    const response = await fetch(`${env.supabaseUrl}/functions/v1/extract-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ imagePaths }),
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; code?: string; ok?: boolean; data?: unknown }
      | null

    if (!response.ok) {
      throw new ExtractionError(
        payload?.error ?? 'La IA no pudo procesar el recibo. Intenta de nuevo.',
        payload?.code ?? 'server_error',
        response.status,
      )
    }

    if (!payload) throw new ExtractionError('La IA devolvió una respuesta vacía.', 'empty_response')

    try {
      const data = parseReceiptExtraction(payload)
      return {
        data,
        meta: (payload as { meta?: ExtractionResult['meta'] }).meta,
      }
    } catch {
      throw new ExtractionError(
        'La IA devolvió un JSON inválido después de reintentar. El gasto quedará para revisión manual.',
        'invalid_json',
      )
    }
  } catch (error) {
    if (error instanceof ExtractionError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ExtractionError('La IA tardó demasiado. Puedes reintentar o completar el gasto a mano.', 'timeout')
    }
    throw new ExtractionError('No pudimos conectar con el servicio de IA. Revisa tu conexión.', 'network')
  } finally {
    window.clearTimeout(timeout)
  }
}
