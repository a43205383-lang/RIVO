import { config, assertServerConfig, serviceHeaders } from '../_shared/env.ts'
import { requireUser, isAccountant } from '../_shared/auth.ts'
import { HttpError, corsHeaders, failure, json, readJson } from '../_shared/http.ts'
import { askModel, asRecord, type ModelContent } from '../_shared/gemini.ts'
import { startUsage } from '../_shared/usage.ts'

const MAX_IMAGES = 5
const MAX_BYTES = 1_572_864
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH_PATTERN = new RegExp(`^(${UUID})/(${UUID})/([^/]+)$`, 'i')

const SYSTEM_PROMPT = `Eres un extractor de datos de recibos para una app de gastos en República Dominicana.
Analiza las imágenes y devuelve SOLO un objeto JSON válido (sin texto adicional, sin markdown).
El objeto debe tener exactamente esta forma:
{
  "isReceipt": boolean,
  "legible": boolean,
  "reason": string|null,
  "merchant": string|null,
  "date": "YYYY-MM-DD"|null,
  "currency": "DOP"|"USD"|null,
  "subtotal": number|null,
  "tax": number|null,
  "tip": number|null,
  "total": number|null,
  "paymentMethod": "efectivo"|"tarjeta"|"transferencia"|"otro"|null,
  "rnc": string|null,
  "ncf": string|null,
  "category": "alimentos"|"combustible"|"transporte"|"oficina"|"servicios"|"otros",
  "items": [{"description": string, "quantity": number|null, "unitPrice": number|null, "lineTotal": number|null}],
  "confidence": {"merchant": number, "date": number, "total": number},
  "notes": string|null
}
Reglas:
- Si la imagen no es un recibo, devuelve isReceipt=false, legible=false y explica brevemente en "reason"; deja el resto en null, category="otros" e items=[].
- Si es un recibo pero no se puede leer, devuelve isReceipt=true, legible=false y explica en "reason".
- No inventes datos. Si un campo no aparece, usa null. Nunca adivines un total.
- Los montos son números sin símbolos de moneda y con punto decimal (ejemplo: 1250.50).
- "date" siempre en formato YYYY-MM-DD. Si el recibo dice 20/11/2026, devuelve "2026-11-20".
- "category" debe ser una sola de las opciones listadas; elige "otros" si no encaja claramente.
- "confidence" va de 0 a 1. Usa valores bajos cuando la imagen esté borrosa o el dato sea dudoso.
- "items" solo con líneas realmente visibles; máximo 100.
Responde siempre en este mismo esquema, incluso si hay varias imágenes del mismo recibo.`

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || ['null', 'n/a', 'na', 'no aplica', '-', '—'].includes(trimmed.toLowerCase())) return null
  return trimmed
}

function money(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
        : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 999_999_999 ? Math.round(parsed * 100) / 100 : null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  return null
}

function currency(value: unknown): 'DOP' | 'USD' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (['DOP', 'RD$', 'RDS', 'PESO', 'PESOS', 'DOMINICAN PESO'].includes(normalized)) return 'DOP'
  if (['USD', 'US$', '$', 'DOLAR', 'DÓLAR', 'DOLLAR'].includes(normalized)) return 'USD'
  return null
}

function paymentMethod(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['efectivo', 'cash', 'contado'].includes(normalized)) return 'efectivo'
  if (['tarjeta', 'card', 'crédito', 'credito', 'débito', 'debito', 'visa', 'mastercard'].includes(normalized)) return 'tarjeta'
  if (['transferencia', 'transfer', 'ach', 'banco'].includes(normalized)) return 'transferencia'
  if (['otro', 'other'].includes(normalized)) return 'otro'
  return null
}

const CATEGORIES = new Set(['alimentos', 'combustible', 'transporte', 'oficina', 'servicios', 'otros'])

function category(value: unknown): string {
  if (typeof value !== 'string') return 'otros'
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, string> = {
    comida: 'alimentos',
    comidas: 'alimentos',
    supermercado: 'alimentos',
    restaurante: 'alimentos',
    food: 'alimentos',
    gasolina: 'combustible',
    gasoil: 'combustible',
    fuel: 'combustible',
    gas: 'combustible',
    taxi: 'transporte',
    uber: 'transporte',
    pasaje: 'transporte',
    transport: 'transporte',
    papelería: 'oficina',
    papeleria: 'oficina',
    office: 'oficina',
    suministros: 'oficina',
    luz: 'servicios',
    agua: 'servicios',
    internet: 'servicios',
    telefonía: 'servicios',
    telefonia: 'servicios',
    utilities: 'servicios',
  }
  const resolved = aliases[normalized] ?? normalized
  return CATEGORIES.has(resolved) ? resolved : 'otros'
}

function confidence(value: unknown): Record<string, number> {
  const record = asRecord(value)
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(record)) {
    const numeric = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(numeric)) continue
    result[key] = numeric > 1 ? Math.min(numeric / 100, 1) : Math.max(0, Math.min(numeric, 1))
  }
  return result
}

function normalizeExtraction(raw: Record<string, unknown>) {
  const isReceipt = raw.isReceipt === true || raw.isReceipt === 'true'
  const legible = raw.legible === true || raw.legible === 'true'
  const empty = {
    merchant: null,
    date: null,
    currency: null,
    subtotal: null,
    tax: null,
    tip: null,
    total: null,
    paymentMethod: null,
    rnc: null,
    ncf: null,
    items: [] as Array<Record<string, unknown>>,
  }

  if (!isReceipt || !legible) {
    return {
      isReceipt,
      legible,
      reason: nullableText(raw.reason) ?? (isReceipt ? 'El recibo no se puede leer con confianza.' : 'La imagen no parece un recibo.'),
      ...empty,
      category: 'otros',
      confidence: confidence(raw.confidence),
      notes: null,
    }
  }

  const items = Array.isArray(raw.items)
    ? raw.items.slice(0, 100).map((item) => {
        const record = asRecord(item)
        return {
          description: nullableText(record.description) ?? '',
          quantity: money(record.quantity),
          unitPrice: money(record.unitPrice),
          lineTotal: money(record.lineTotal),
        }
      })
    : []

  return {
    isReceipt,
    legible,
    reason: nullableText(raw.reason),
    merchant: nullableText(raw.merchant),
    date: isoDate(raw.date),
    currency: currency(raw.currency),
    subtotal: money(raw.subtotal),
    tax: money(raw.tax),
    tip: money(raw.tip),
    total: money(raw.total),
    paymentMethod: paymentMethod(raw.paymentMethod),
    rnc: nullableText(raw.rnc),
    ncf: nullableText(raw.ncf),
    category: category(raw.category),
    items,
    confidence: confidence(raw.confidence),
    notes: nullableText(raw.notes),
  }
}

function imagePathsFrom(body: unknown): string[] {
  const record = asRecord(body)
  if (!Array.isArray(record.imagePaths)) {
    throw new HttpError('Faltan las imágenes del recibo.', 'no_images', 400)
  }
  const paths = record.imagePaths.filter((value): value is string => typeof value === 'string')
  if (paths.length === 0 || paths.length > MAX_IMAGES) {
    throw new HttpError(`Adjunta entre 1 y ${MAX_IMAGES} imágenes.`, 'invalid_images', 400)
  }
  for (const path of paths) {
    const match = PATH_PATTERN.exec(path)
    if (!match || path.includes('..') || !/\.(jpe?g|png|webp)$/i.test(match[3])) {
      throw new HttpError('Una de las rutas de imagen no es válida.', 'invalid_path', 400)
    }
  }
  return paths
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function downloadImage(path: string): Promise<string> {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/receipts/${encoded}`, {
    headers: serviceHeaders(),
  })
  if (!response.ok) {
    throw new HttpError('No pudimos leer una de las imágenes del recibo.', 'storage_error', 502)
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
    throw new HttpError('Una de las imágenes es demasiado grande o está vacía.', 'invalid_image', 400)
  }
  const headerType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const mime = headerType.startsWith('image/') ? headerType : 'image/jpeg'
  return `data:${mime};base64,${toBase64(new Uint8Array(buffer))}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.', code: 'method_not_allowed' }, 405)
  }

  let status: 'succeeded' | 'failed' = 'failed'
  let ticket: Awaited<ReturnType<typeof startUsage>> | null = null

  try {
    assertServerConfig()
    const user = await requireUser(req)
    const paths = imagePathsFrom(await readJson(req))
    const canReadAll = await isAccountant(user.id)
    if (!canReadAll) {
      const owner = paths[0].split('/')[0]
      if (paths.some((path) => path.split('/')[0] !== owner || owner !== user.id)) {
        throw new HttpError('No tienes permiso para analizar esas imágenes.', 'forbidden_path', 403)
      }
    }

    ticket = await startUsage(user.id, 'extract')
    const images = await Promise.all(paths.map(downloadImage))
    const content: ModelContent = [
      { type: 'text', text: 'Extrae los datos de este recibo y devuelve el JSON solicitado.' },
      ...images.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } })),
    ]

    let lastError: unknown = null
    let reply: Awaited<ReturnType<typeof askModel>> | null = null
    let retryCount = 0
    for (let attempt = 0; attempt < 2; attempt += 1) {
      retryCount = attempt
      try {
        reply = await askModel({
          system:
            attempt === 0
              ? SYSTEM_PROMPT
              : `${SYSTEM_PROMPT}\n\nIMPORTANTE: tu respuesta anterior no era un JSON válido. Devuelve únicamente el objeto JSON.`,
          content,
          model: config.visionModel,
          maxTokens: 1800,
        })
        break
      } catch (caught) {
        lastError = caught
        if (caught instanceof HttpError && caught.code.startsWith('ai_')) break
      }
    }

    if (!reply) {
      if (lastError instanceof HttpError) throw lastError
      throw new HttpError('La IA no pudo analizar el recibo. Intenta con otra foto.', 'invalid_json', 502)
    }

    const data = normalizeExtraction(reply.data)
    status = 'succeeded'
    return json({
      ok: true,
      data,
      meta: { model: reply.model, retryCount, remaining: ticket.remaining },
    })
  } catch (error) {
    return failure(error)
  } finally {
    if (ticket) await ticket.finish(status)
  }
})
