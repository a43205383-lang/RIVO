// Dashboard-ready, single-file version of RIVO's extract-receipt Edge Function.
// Create a function named "extract-receipt" in Supabase Dashboard and paste this file.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_IMAGES = 5
const MAX_BYTES = 1_572_864
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH_PATTERN = new RegExp(`^(${UUID})/(${UUID})/([^/]+)$`, 'i')
const SYSTEM_PROMPT = `Eres un extractor de recibos para una app de gastos de República Dominicana.
Devuelve únicamente JSON con esta forma:
{"isReceipt":boolean,"legible":boolean,"reason":string|null,"merchant":string|null,"date":"YYYY-MM-DD"|null,"currency":"DOP"|"USD"|null,"subtotal":number|null,"tax":number|null,"tip":number|null,"total":number|null,"paymentMethod":"efectivo"|"tarjeta"|"transferencia"|"otro"|null,"rnc":string|null,"ncf":string|null,"category":"alimentos"|"combustible"|"transporte"|"oficina"|"servicios"|"otros","items":[{"description":string,"quantity":number|null,"unitPrice":number|null,"lineTotal":number|null}],"confidence":{"merchant":number,"date":number,"total":number},"notes":string|null}
No inventes datos. Si no es recibo, usa isReceipt=false, legible=false, campos de recibo null, category="otros" e items=[]. Si no se puede leer, legible=false. Moneda predeterminada DOP solo si el recibo la demuestra. Montos como números sin símbolo. Fecha ISO. ITBIS es tax. Items solo visibles, máximo 100. Confidence de 0 a 1.`

type AppError = Error & { status?: number; code?: string }

function fail(message: string, code: string, status: number): AppError {
  return Object.assign(new Error(message), { code, status })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return !text || ['null', 'n/a', 'na', 'no aplica', '-', '—'].includes(text.toLowerCase()) ? null : text
}

function money(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim().replace(',', '.')) : NaN
  return Number.isFinite(n) && n >= 0 && n <= 999_999_999 ? Math.round(n * 100) / 100 : null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text)
  if (!dmy) return null
  return `${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
}

function normalize(raw: Record<string, unknown>) {
  const isReceipt = raw.isReceipt === true || raw.isReceipt === 'true'
  const legible = raw.legible === true || raw.legible === 'true'
  const currencyText = String(raw.currency ?? '').trim().toUpperCase()
  const currency = ['DOP', 'RD$', 'RDS', 'PESO', 'PESOS'].includes(currencyText)
    ? 'DOP'
    : ['USD', 'US$', '$', 'DOLAR', 'DÓLAR', 'DOLLAR'].includes(currencyText) ? 'USD' : null
  const paymentText = String(raw.paymentMethod ?? '').trim().toLowerCase()
  const paymentMethod = ['efectivo', 'cash', 'contado'].includes(paymentText) ? 'efectivo'
    : ['tarjeta', 'card', 'crédito', 'credito', 'débito', 'debito', 'visa', 'mastercard'].includes(paymentText) ? 'tarjeta'
    : ['transferencia', 'transfer', 'ach', 'banco'].includes(paymentText) ? 'transferencia'
    : ['otro', 'other'].includes(paymentText) ? 'otro' : null
  const aliases: Record<string, string> = {
    comida: 'alimentos', comidas: 'alimentos', supermercado: 'alimentos', restaurante: 'alimentos', food: 'alimentos',
    gasolina: 'combustible', gasoil: 'combustible', fuel: 'combustible', gas: 'combustible',
    taxi: 'transporte', uber: 'transporte', pasaje: 'transporte', transport: 'transporte',
    papelería: 'oficina', papeleria: 'oficina', office: 'oficina', suministros: 'oficina',
    luz: 'servicios', agua: 'servicios', internet: 'servicios', telefonía: 'servicios', telefonia: 'servicios', utilities: 'servicios',
  }
  const categoryCandidate = String(raw.category ?? '').trim().toLowerCase()
  const category = aliases[categoryCandidate] ?? categoryCandidate
  const allowedCategories = ['alimentos', 'combustible', 'transporte', 'oficina', 'servicios', 'otros']
  const confidenceRaw = asRecord(raw.confidence)
  const confidence: Record<string, number> = {}
  for (const [key, value] of Object.entries(confidenceRaw)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) confidence[key] = n > 1 ? Math.min(n / 100, 1) : Math.max(0, Math.min(n, 1))
  }
  const items = Array.isArray(raw.items) ? raw.items.slice(0, 100).map((item) => {
    const row = asRecord(item)
    return { description: nullableText(row.description) ?? '', quantity: money(row.quantity), unitPrice: money(row.unitPrice), lineTotal: money(row.lineTotal) }
  }) : []

  if (!isReceipt || !legible) {
    return {
      isReceipt, legible,
      reason: nullableText(raw.reason) ?? (isReceipt ? 'El recibo no se puede leer con confianza.' : 'La imagen no parece un recibo.'),
      merchant: null, date: null, currency: null, subtotal: null, tax: null, tip: null, total: null,
      paymentMethod: null, rnc: null, ncf: null, category: 'otros', items: [], confidence, notes: null,
    }
  }

  return {
    isReceipt, legible, reason: nullableText(raw.reason), merchant: nullableText(raw.merchant),
    date: isoDate(raw.date), currency, subtotal: money(raw.subtotal), tax: money(raw.tax), tip: money(raw.tip),
    total: money(raw.total), paymentMethod, rnc: nullableText(raw.rnc), ncf: nullableText(raw.ncf),
    category: allowedCategories.includes(category) ? category : 'otros', items, confidence, notes: nullableText(raw.notes),
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, parts: Array<Record<string, unknown>>) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0, maxOutputTokens: 1800, responseMimeType: 'application/json' },
    }),
  })
  const payload = await response.json().catch(() => null) as Record<string, any> | null
  if (!response.ok) {
    console.error('[rivo] Gemini error', response.status, payload?.error?.status ?? '')
    if (response.status === 429) throw fail('El servicio de IA está saturado. Intenta más tarde.', 'ai_busy', 503)
    if (response.status >= 500) throw fail('El servicio de IA no está disponible.', 'ai_unavailable', 502)
    throw fail('Gemini no pudo procesar el recibo. Revisa la clave y el modelo configurados.', 'ai_request', 502)
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim()
  if (!text) throw fail('Gemini devolvió una respuesta vacía.', 'empty_response', 502)
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw fail('Gemini devolvió JSON inválido.', 'invalid_json', 502) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw fail('Gemini devolvió un formato inesperado.', 'invalid_json', 502)
  return { data: parsed as Record<string, unknown>, model: payload?.modelVersion ?? model }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.', code: 'method_not_allowed' }, 405)

  try {
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
    const model = Deno.env.get('GEMINI_VISION_MODEL') ?? 'gemini-3.5-flash'
    if (!supabaseUrl || !anonKey || !geminiKey) throw fail('Falta configuración de Supabase o GEMINI_API_KEY.', 'server_config', 500)

    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
    if (!token) throw fail('Inicia sesión para analizar el recibo.', 'no_session', 401)

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
    if (!authResponse.ok) throw fail('La sesión no es válida. Vuelve a iniciar sesión.', 'invalid_session', 401)
    const user = await authResponse.json() as { id?: string }
    if (!user.id) throw fail('La sesión no es válida.', 'invalid_session', 401)

    const body = await req.json().catch(() => null) as { imagePaths?: unknown } | null
    if (!Array.isArray(body?.imagePaths) || body.imagePaths.length < 1 || body.imagePaths.length > MAX_IMAGES) {
      throw fail(`Adjunta entre 1 y ${MAX_IMAGES} fotos.`, 'invalid_images', 400)
    }
    const paths = body.imagePaths.filter((p): p is string => typeof p === 'string')
    if (paths.length !== body.imagePaths.length || paths.some((path) => !PATH_PATTERN.test(path) || path.includes('..') || !/\.(jpe?g|png|webp)$/i.test(path))) {
      throw fail('Una de las rutas de imagen no es válida.', 'invalid_path', 400)
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/is_accountant`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
    })
    const accountant = rpcResponse.ok ? await rpcResponse.json().catch(() => false) === true : false
    const owner = paths[0].split('/')[0]
    if (!accountant && paths.some((path) => path.split('/')[0] !== user.id || path.split('/')[0] !== owner)) {
      throw fail('No tienes permiso para analizar esas imágenes.', 'forbidden_path', 403)
    }

    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    const usageUrl = `${supabaseUrl}/rest/v1/ai_usage?select=id&user_id=eq.${user.id}&kind=eq.extract&created_at=gte.${encodeURIComponent(today.toISOString())}`
    const usageResponse = await fetch(usageUrl, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
    if (!usageResponse.ok) throw fail('No pudimos verificar tu límite diario de IA.', 'quota_check', 503)
    const usageRows = await usageResponse.json() as unknown[]
    const limit = Number(Deno.env.get('AI_EXTRACT_DAILY_LIMIT') ?? '50')
    if (limit > 0 && usageRows.length >= limit) throw fail('Alcanzaste el límite diario de análisis. Vuelve mañana.', 'quota_exceeded', 429)
    const insertUsage = await fetch(`${supabaseUrl}/rest/v1/ai_usage`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, kind: 'extract', status: 'started' }),
    })
    if (!insertUsage.ok) throw fail('No pudimos registrar el análisis.', 'quota_record', 503)
    const usageRecord = await insertUsage.json() as Array<{ id: number }>
    const usageId = usageRecord[0]?.id

    const parts: Array<Record<string, unknown>> = [{ text: 'Extrae los datos visibles de este recibo y devuelve el JSON solicitado.' }]
    for (const path of paths) {
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      const imageResponse = await fetch(`${supabaseUrl}/storage/v1/object/receipts/${encoded}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      })
      if (!imageResponse.ok) throw fail('No pudimos leer una imagen del recibo.', 'storage_error', 400)
      const bytes = new Uint8Array(await imageResponse.arrayBuffer())
      if (!bytes.length || bytes.length > MAX_BYTES) throw fail('La imagen supera 1.5 MB o está vacía.', 'invalid_image', 400)
      const mimeType = (imageResponse.headers.get('content-type') ?? 'image/jpeg').split(';')[0].toLowerCase()
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw fail('El archivo no es una imagen compatible.', 'invalid_image', 400)
      parts.push({ inlineData: { mimeType, data: toBase64(bytes) } })
    }

    let reply: { data: Record<string, unknown>; model: string } | null = null
    let retryCount = 0
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      retryCount = attempt
      try {
        const prompt = attempt === 0 ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\nTu respuesta anterior no era JSON válido. Devuelve únicamente un objeto JSON.`
        reply = await callGemini(geminiKey, model, prompt, parts)
        break
      } catch (error) {
        lastError = error
        if ((error as AppError)?.code !== 'invalid_json') throw error
      }
    }
    if (!reply) throw lastError ?? fail('No se pudo analizar el recibo.', 'invalid_json', 502)

    const data = normalize(reply.data)
    if (usageId) await fetch(`${supabaseUrl}/rest/v1/ai_usage?id=eq.${usageId}`, {
      method: 'PATCH', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'succeeded' }),
    }).catch(() => undefined)
    return json({ ok: true, data, meta: { model: reply.model, retryCount, remaining: limit > 0 ? Math.max(0, limit - usageRows.length - 1) : null } })
  } catch (error) {
    const appError = error as AppError
    console.error('[rivo] extract-receipt error', appError.code ?? 'internal_error')
    return json({ error: appError.status ? appError.message : 'El servicio tuvo un problema inesperado.', code: appError.code ?? 'internal_error' }, appError.status ?? 500)
  }
})
