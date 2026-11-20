import { config, assertServerConfig, serviceHeaders } from '../_shared/env.ts'
import { requireUser, isAccountant } from '../_shared/auth.ts'
import { HttpError, corsHeaders, failure, json, readJson } from '../_shared/http.ts'
import { askModel, asRecord } from '../_shared/openai.ts'
import { startUsage } from '../_shared/usage.ts'

const MAX_ROWS = 150
const MAX_ANSWER_ROWS = 50

type ExpenseRow = {
  id: string
  merchant: string | null
  expense_date: string | null
  total: number | string | null
  currency: 'DOP' | 'USD'
  category: string
  status: string
}

const SYSTEM_PROMPT = `Eres un analista de gastos de una empresa en República Dominicana.
Responde SIEMPRE con un objeto JSON válido, sin texto adicional ni markdown:
{"answer": string, "rows": [{"id": string}]}

Reglas:
- Responde en español, de forma breve y concreta (máximo 4 frases).
- Usa SOLO los datos del listado que te envío. Calcula sumas y conteos tú mismo. Nunca inventes cifras ni commercios.
- Si la pregunta no se puede responder con los datos disponibles, dilo claramente en "answer".
- "rows" debe contener únicamente los ids de los gastos directamente relacionados con la respuesta (por ejemplo, los gastos más altos o los que piden revisión). Máximo ${MAX_ANSWER_ROWS}. Si no aplica, devuelve [].
- Los importes ya están en la moneda indicada en cada fila. No mezcles DOP con USD sin avisar.
- No repitas el listado completo en la respuesta.`

function questionFrom(body: unknown): string {
  const record = asRecord(body)
  if (typeof record.question !== 'string') {
    throw new HttpError('Escribe una pregunta.', 'too_short', 400)
  }
  const question = record.question.trim()
  if (question.length < 3) throw new HttpError('Escribe una pregunta un poco más larga.', 'too_short', 400)
  if (question.length > 500) throw new HttpError('La pregunta no puede superar 500 caracteres.', 'too_long', 400)
  return question
}

async function fetchRows(userId: string, scopeAll: boolean): Promise<ExpenseRow[]> {
  const select = 'id,merchant,expense_date,total,currency,category,status'
  const url =
    `${config.supabaseUrl}/rest/v1/expenses?select=${select}` +
    `&order=created_at.desc&limit=${MAX_ROWS}` +
    (scopeAll ? '' : `&user_id=eq.${encodeURIComponent(userId)}`)

  const response = await fetch(url, { headers: serviceHeaders() })
  if (!response.ok) throw new HttpError('No pudimos consultar tus gastos.', 'expenses_error', 502)
  const rows = await response.json().catch(() => [])
  if (!Array.isArray(rows)) return []
  return rows
    .filter((row): row is ExpenseRow => Boolean(row && typeof row.id === 'string'))
    .map((row) => ({
      id: row.id,
      merchant: typeof row.merchant === 'string' ? row.merchant : null,
      expense_date: typeof row.expense_date === 'string' ? row.expense_date : null,
      total: typeof row.total === 'number' || typeof row.total === 'string' ? row.total : null,
      currency: row.currency === 'USD' ? 'USD' : 'DOP',
      category: typeof row.category === 'string' ? row.category : 'otros',
      status: typeof row.status === 'string' ? row.status : 'draft',
    }))
}

function summarize(rows: ExpenseRow[]) {
  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byCurrency: Record<string, number> = {}
  for (const row of rows) {
    const amount = typeof row.total === 'number' ? row.total : Number(row.total)
    const value = Number.isFinite(amount) ? amount : 0
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    byCategory[row.category] = (byCategory[row.category] ?? 0) + value
    byCurrency[row.currency] = (byCurrency[row.currency] ?? 0) + value
  }
  return {
    count: rows.length,
    byStatus,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([key, value]) => [key, Math.round(value * 100) / 100]),
    ),
    byCurrency: Object.fromEntries(
      Object.entries(byCurrency).map(([key, value]) => [key, Math.round(value * 100) / 100]),
    ),
  }
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
    const question = questionFrom(await readJson(req))
    const accountant = await isAccountant(user.id)
    const scope = accountant ? 'all' : 'own'

    ticket = await startUsage(user.id, 'ask')
    const rows = await fetchRows(user.id, accountant)
    const byId = new Map(rows.map((row) => [row.id, row]))
    const dates = rows
      .map((row) => row.expense_date)
      .filter((value): value is string => Boolean(value))
      .sort()

    const payload = JSON.stringify({
      pregunta: question,
      alcance: accountant ? 'todos los gastos de la empresa' : 'solo los gastos del usuario',
      resumen: summarize(rows),
      gastos: rows.map((row) => ({
        id: row.id,
        comercio: row.merchant,
        fecha: row.expense_date,
        total: row.total,
        moneda: row.currency,
        categoria: row.category,
        estado: row.status,
      })),
    })

    const reply = await askModel({
      system: SYSTEM_PROMPT,
      content: `Datos disponibles (JSON):\n${payload}`,
      maxTokens: 900,
    })

    const rawAnswer = reply.data.answer
    const answer = typeof rawAnswer === 'string' ? rawAnswer.trim() : ''
    if (!answer) throw new HttpError('La IA no pudo responder la pregunta.', 'empty_response', 502)

    const rawRows = Array.isArray(reply.data.rows) ? reply.data.rows : []
    const selected = new Set<string>()
    for (const item of rawRows) {
      const id = asRecord(item).id
      if (typeof id === 'string' && byId.has(id)) selected.add(id)
      if (selected.size >= MAX_ANSWER_ROWS) break
    }

    status = 'succeeded'
    return json({
      ok: true,
      answer,
      rows: [...selected].map((id) => byId.get(id)),
      meta: {
        model: reply.model,
        remaining: ticket.remaining,
        scope,
        ...(dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : {}),
      },
    })
  } catch (error) {
    return failure(error)
  } finally {
    if (ticket) await ticket.finish(status)
  }
})
