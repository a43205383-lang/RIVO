import type { Json, ExpenseUpdate } from '@/shared/types/database.types'
import type { ReceiptExtraction } from '@/features/extraction/schemas'
import { extractionToForm, formItemsToRows, extractionConfidence } from '@/features/expenses/lib/form'

export interface ExtractionMapping {
  patch: ExpenseUpdate
  items: ReturnType<typeof formItemsToRows>
  isReceipt: boolean
  isLegible: boolean
}

export function mapExtractionToExpense(data: ReceiptExtraction): ExtractionMapping {
  const confidence = extractionConfidence(data) as Json

  if (!data.isReceipt || !data.legible) {
    return {
      patch: {
        merchant: null,
        expense_date: null,
        currency: 'DOP',
        subtotal: null,
        tax: null,
        tip: null,
        total: null,
        payment_method: null,
        rnc: null,
        ncf: null,
        category: 'otros',
        notes: data.reason ?? null,
        status: 'needs_review',
        ai_confidence: confidence,
        ai_notes: data.reason ?? (data.isReceipt ? 'El recibo está ilegible.' : 'La imagen no parece ser un recibo.'),
        review_reason: data.isReceipt ? 'illegible' : 'not_receipt',
      },
      items: [],
      isReceipt: data.isReceipt,
      isLegible: data.legible,
    }
  }

  const form = extractionToForm(data)
  return {
    patch: {
      merchant: data.merchant,
      expense_date: data.date,
      currency: data.currency ?? 'DOP',
      subtotal: data.subtotal,
      tax: data.tax,
      tip: data.tip,
      total: data.total,
      payment_method: data.paymentMethod,
      rnc: data.rnc,
      ncf: data.ncf,
      category: data.category,
      notes: data.notes,
      status: 'needs_review',
      ai_confidence: confidence,
      ai_notes: null,
      review_reason: null,
    },
    items: formItemsToRows(form),
    isReceipt: true,
    isLegible: true,
  }
}
