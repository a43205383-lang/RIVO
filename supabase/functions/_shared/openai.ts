import { config } from './env.ts'
import { HttpError } from './http.ts'

export type ModelContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } }
    >

export interface ModelReply {
  data: Record<string, unknown>
  model: string
}

/** Llama a Chat Completions con salida JSON y devuelve el objeto ya parseado. */
export async function askModel({
  system,
  content,
  model = config.textModel,
  maxTokens = 900,
}: {
  system: string
  content: ModelContent
  model?: string
  maxTokens?: number
}): Promise<ModelReply> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
    }),
  })

  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    console.error('[rivo] OpenAI respondió', response.status, details?.error?.message ?? '')
    if (response.status === 401 || response.status === 403) {
      throw new HttpError('La llave de IA no es válida. Revisa el secreto OPENAI_API_KEY.', 'ai_auth', 502)
    }
    if (response.status === 429) {
      throw new HttpError('El servicio de IA está saturado. Intenta de nuevo en unos minutos.', 'ai_busy', 503)
    }
    if (response.status >= 500) {
      throw new HttpError('El servicio de IA no está disponible. Intenta de nuevo.', 'ai_unavailable', 502)
    }
    throw new HttpError('La IA no pudo procesar la solicitud.', 'ai_request', 502)
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
    model?: string
  } | null
  const text = payload?.choices?.[0]?.message?.content
  if (!text) throw new HttpError('La IA devolvió una respuesta vacía.', 'empty_response', 502)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new HttpError('La IA devolvió un JSON inválido.', 'invalid_json', 502)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError('La IA devolvió un formato inesperado.', 'invalid_json', 502)
  }
  return { data: parsed as Record<string, unknown>, model: payload?.model ?? model }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
