import { z } from 'zod'
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/shared/types/domain'

const nullableMoney = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value === null || value === '') return null
    const parsed =
      typeof value === 'number'
        ? value
        : Number(value.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null
  })
  .pipe(z.number().min(0).max(999_999_999).nullable())

const nullableText = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed || ['null', 'n/a', 'na', 'no aplica', '-', '—'].includes(trimmed.toLowerCase())) return null
    return trimmed
  })

const dateSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (!value) return null
    const trimmed = value.trim()
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed)
    if (dmy) {
      const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
      return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    }
    return null
  })
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable())

const currencySchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const normalized = (value ?? '').trim().toUpperCase()
    if (['DOP', 'RD$', 'RDS', 'PESO', 'PESOS', 'DOMINICAN PESO'].includes(normalized)) return 'DOP'
    if (['USD', 'US$', '$', 'DOLAR', 'DÓLAR', 'DOLLAR'].includes(normalized)) return 'USD'
    return null
  })
  .pipe(z.enum(CURRENCIES).nullable())

const paymentSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const normalized = (value ?? '').trim().toLowerCase()
    if (!normalized) return null
    if (['efectivo', 'cash', 'contado'].includes(normalized)) return 'efectivo'
    if (['tarjeta', 'card', 'crédito', 'credito', 'débito', 'debito', 'visa', 'mastercard'].includes(normalized))
      return 'tarjeta'
    if (['transferencia', 'transfer', 'ach', 'banco'].includes(normalized)) return 'transferencia'
    if (['otro', 'other'].includes(normalized)) return 'otro'
    return null
  })
  .pipe(z.enum(PAYMENT_METHODS).nullable())

const categorySchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const normalized = (value ?? '').trim().toLowerCase()
    if (['alimentos', 'comida', 'comidas', 'supermercado', 'restaurante', 'food'].includes(normalized)) return 'alimentos'
    if (['combustible', 'gasolina', 'gasoil', 'fuel', 'gas'].includes(normalized)) return 'combustible'
    if (['transporte', 'taxi', 'uber', 'pasaje', 'transport'].includes(normalized)) return 'transporte'
    if (['oficina', 'papelería', 'papeleria', 'office', 'suministros'].includes(normalized)) return 'oficina'
    if (['servicios', 'luz', 'agua', 'internet', 'telefonía', 'telefonia', 'utilities'].includes(normalized))
      return 'servicios'
    return 'otros'
  })
  .pipe(z.enum(EXPENSE_CATEGORIES))

const confidenceSchema = z
  .record(z.string(), z.number())
  .default({})
  .transform((record) => {
    const normalized: Record<string, number> = {}
    for (const [key, value] of Object.entries(record)) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) continue
      normalized[key] = numeric > 1 ? Math.min(numeric / 100, 1) : Math.max(0, Math.min(numeric, 1))
    }
    return normalized
  })

export const receiptItemSchema = z.object({
  description: z.union([z.string(), z.null()]).transform((value) => (value ?? '').trim()),
  quantity: nullableMoney,
  unitPrice: nullableMoney,
  lineTotal: nullableMoney,
})

export const receiptExtractionSchema = z.object({
  isReceipt: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === 'true'),
  legible: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === 'true'),
  reason: nullableText,
  merchant: nullableText,
  date: dateSchema,
  currency: currencySchema,
  subtotal: nullableMoney,
  tax: nullableMoney,
  tip: nullableMoney,
  total: nullableMoney,
  paymentMethod: paymentSchema,
  rnc: nullableText,
  ncf: nullableText,
  category: categorySchema,
  items: z.array(receiptItemSchema).max(100).default([]),
  confidence: confidenceSchema,
  notes: nullableText,
})

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>

export const extractionSuccessSchema = z.object({
  ok: z.literal(true),
  data: receiptExtractionSchema,
  meta: z
    .object({
      model: z.string().optional(),
      retryCount: z.number().optional(),
      remaining: z.number().nullable().optional(),
    })
    .optional(),
})

export const extractionErrorSchema = z.object({
  ok: z.literal(false).optional(),
  error: z.string(),
  code: z.string().optional(),
})

export function parseReceiptExtraction(payload: unknown): ReceiptExtraction {
  // The AI may wrap the object in { receipt: ... } or similar; unwrap the common shapes.
  let candidate = payload
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const record = candidate as Record<string, unknown>
    if (record.data && typeof record.data === 'object') candidate = record.data
    else if (record.receipt && typeof record.receipt === 'object') candidate = record.receipt
  }
  return receiptExtractionSchema.parse(candidate)
}
