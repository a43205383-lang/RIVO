import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '@/shared/types/domain'

const rowSchema = z
  .object({
    id: z.string(),
    merchant: z.string().nullish(),
    expense_date: z.string().nullish(),
    total: z.union([z.number(), z.string(), z.null()]).optional(),
    currency: z.enum(CURRENCIES).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    status: z.enum(EXPENSE_STATUSES).optional(),
  })
  .transform((row) => {
    const total =
      typeof row.total === 'number'
        ? row.total
        : typeof row.total === 'string' && row.total.trim() !== ''
          ? Number(row.total)
          : null
    return {
      id: row.id,
      merchant: row.merchant ?? null,
      expense_date: row.expense_date ?? null,
      total: total !== null && Number.isFinite(total) ? total : null,
      currency: row.currency ?? ('DOP' as const),
      category: row.category ?? ('otros' as const),
      status: row.status ?? ('approved' as const),
    }
  })

const responseSchema = z.object({
  ok: z.literal(true).optional(),
  answer: z.string().min(1),
  rows: z.array(rowSchema).max(50).optional(),
  meta: z
    .object({
      model: z.string().optional(),
      remaining: z.number().nullable().optional(),
      scope: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .partial()
    .optional(),
})

export interface AskExpenseRow {
  id: string
  merchant: string | null
  expense_date: string | null
  total: number | null
  currency: (typeof CURRENCIES)[number]
  category: (typeof EXPENSE_CATEGORIES)[number]
  status: (typeof EXPENSE_STATUSES)[number]
}

export interface AskResult {
  answer: string
  rows: AskExpenseRow[]
  meta?: {
    model?: string
    remaining?: number | null
    scope?: string
  }
}

export class AskError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'unknown', status = 0) {
    super(message)
    this.name = 'AskError'
    this.code = code
    this.status = status
  }
}

export async function askExpenses(question: string): Promise<AskResult> {
  const trimmed = question.trim()
  if (trimmed.length < 3) throw new AskError('Escribe una pregunta un poco más larga.', 'too_short')
  if (trimmed.length > 500) throw new AskError('La pregunta no puede superar 500 caracteres.', 'too_long')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new AskError('Tu sesión venció. Vuelve a iniciar sesión.', 'no_session', 401)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(`${env.supabaseUrl}/functions/v1/ask-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ question: trimmed }),
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; code?: string; answer?: string; rows?: unknown; meta?: unknown }
      | null

    if (!response.ok) {
      throw new AskError(
        payload?.error ?? 'La consulta no pudo completarse. Intenta de nuevo.',
        payload?.code ?? 'server_error',
        response.status,
      )
    }
    if (!payload) throw new AskError('La IA devolvió una respuesta vacía.', 'empty_response')

    const parsed = responseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new AskError('La IA devolvió una respuesta con un formato inesperado.', 'invalid_response')
    }

    return {
      answer: parsed.data.answer,
      rows: (parsed.data.rows ?? []) as AskExpenseRow[],
      meta: parsed.data.meta
        ? {
            model: parsed.data.meta.model,
            remaining: parsed.data.meta.remaining,
            scope: parsed.data.meta.scope,
          }
        : undefined,
    }
  } catch (error) {
    if (error instanceof AskError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AskError('La consulta tardó demasiado. Intenta con una pregunta más concreta.', 'timeout')
    }
    throw new AskError('No pudimos conectar con el servicio de consultas. Revisa tu conexión.', 'network')
  } finally {
    window.clearTimeout(timeout)
  }
}
