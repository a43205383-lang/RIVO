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

function toGeminiParts(content: ModelContent): Array<Record<string, unknown>> {
  if (typeof content === 'string') return [{ text: content }]
  return content.map((part) => {
    if (part.type === 'text') return { text: part.text }
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(part.image_url.url)
    if (!match) throw new HttpError('La imagen no tiene un formato válido.', 'invalid_image', 400)
    return { inlineData: { mimeType: match[1], data: match[2] } }
  })
}

/** Calls Gemini generateContent and parses its JSON-only response. */
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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.geminiApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: toGeminiParts(content) }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as {
      error?: { message?: string; status?: string }
    } | null
    const reason = details?.error?.status ?? details?.error?.message ?? ''
    console.error('[rivo] Gemini respondió', response.status, reason)
    if (
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && /api.?key|credential/i.test(reason))
    ) {
      throw new HttpError('La llave de IA no es válida. Revisa el secreto GEMINI_API_KEY.', 'ai_auth', 502)
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
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    modelVersion?: string
  } | null
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
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
  return { data: parsed as Record<string, unknown>, model: payload?.modelVersion ?? model }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
