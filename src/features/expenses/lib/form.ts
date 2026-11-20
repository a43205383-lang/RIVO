import type { ExpenseRow, ExpenseItemRow, ExpenseUpdate } from '@/shared/types/database.types'
import type { ExpenseCategory, PaymentMethod, Currency } from '@/shared/types/domain'
import { todayISO } from '@/shared/lib/date'
import { parseAmount, roundMoney } from '@/shared/lib/money'
import type { ReceiptExtraction } from '@/features/extraction/schemas'
import type { ExpenseFormItem, ExpenseFormValues, ExpenseWithRelations } from '@/features/expenses/types'
import { expenseFormErrors } from '@/features/expenses/lib/validation'

export function newFormItem(description = '', quantity = '1', unitPrice = ''): ExpenseFormItem {
  return {
    key: crypto.randomUUID(),
    description,
    quantity,
    unitPrice,
  }
}

export function emptyExpenseForm(overrides: Partial<ExpenseFormValues> = {}): ExpenseFormValues {
  return {
    merchant: '',
    expenseDate: todayISO(),
    currency: 'DOP',
    subtotal: '',
    tax: '',
    tip: '',
    total: '',
    paymentMethod: '',
    rnc: '',
    ncf: '',
    category: 'otros',
    notes: '',
    items: [],
    ...overrides,
  }
}

function amountInput(value: number | null): string {
  if (value === null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function expenseToForm(expense: ExpenseRow): ExpenseFormValues {
  return {
    merchant: expense.merchant ?? '',
    expenseDate: expense.expense_date ?? '',
    currency: expense.currency,
    subtotal: amountInput(expense.subtotal),
    tax: amountInput(expense.tax),
    tip: amountInput(expense.tip),
    total: amountInput(expense.total),
    paymentMethod: expense.payment_method ?? '',
    rnc: expense.rnc ?? '',
    ncf: expense.ncf ?? '',
    category: expense.category,
    notes: expense.notes ?? '',
    items: [],
  }
}

export function expenseItemsToFormItems(items: ExpenseItemRow[]): ExpenseFormItem[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => newFormItem(item.description, String(item.quantity), item.unit_price === null ? '' : amountInput(item.unit_price)))
}

export function fullFormFromExpense(expense: ExpenseWithRelations): ExpenseFormValues {
  return {
    ...expenseToForm(expense),
    items: expenseItemsToFormItems(expense.items),
  }
}

export function parseStoredConfidence(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numeric = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(numeric)) continue
    const normalized = numeric > 1 ? numeric / 100 : numeric
    result[key] = Math.max(0, Math.min(normalized, 1))
  }
  if (result.date !== undefined && result.expenseDate === undefined) result.expenseDate = result.date
  return result
}

export function extractionToForm(data: ReceiptExtraction): ExpenseFormValues {
  if (!data.isReceipt || !data.legible) {
    return emptyExpenseForm({
      expenseDate: '',
      category: 'otros',
      notes: data.reason ?? '',
      items: [],
    })
  }

  return {
    merchant: data.merchant ?? '',
    expenseDate: data.date ?? '',
    currency: data.currency ?? 'DOP',
    subtotal: amountInput(data.subtotal),
    tax: amountInput(data.tax),
    tip: amountInput(data.tip),
    total: amountInput(data.total),
    paymentMethod: data.paymentMethod ?? '',
    rnc: data.rnc ?? '',
    ncf: data.ncf ?? '',
    category: data.category,
    notes: data.notes ?? '',
    items: data.items
      .filter((item) => item.description || item.lineTotal !== null)
      .map((item) => {
        const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
        const unitPrice =
          item.unitPrice ??
          (item.lineTotal !== null ? roundMoney(item.lineTotal / quantity) : null)
        return newFormItem(item.description, String(quantity), unitPrice === null ? '' : amountInput(unitPrice))
      }),
  }
}

export function extractionConfidence(data: ReceiptExtraction): Record<string, number> {
  const confidence: Record<string, number> = { ...data.confidence }
  if (data.confidence.date !== undefined && data.confidence.expenseDate === undefined) {
    confidence.expenseDate = data.confidence.date
  }
  return confidence
}

export interface FormToUpdateOptions {
  status: 'draft' | 'confirmed'
  isResubmission?: boolean
}

export function formToExpenseUpdate(values: ExpenseFormValues, options: FormToUpdateOptions): ExpenseUpdate {
  const errors = expenseFormErrors(values, options.status === 'confirmed' ? 'confirm' : 'draft')
  if (Object.keys(errors).length > 0) {
    throw new Error('El formulario tiene campos inválidos.')
  }

  const merchant = values.merchant.trim()
  const update: ExpenseUpdate = {
    merchant: merchant || null,
    expense_date: values.expenseDate || null,
    currency: values.currency,
    subtotal: parseAmount(values.subtotal),
    tax: parseAmount(values.tax),
    tip: parseAmount(values.tip),
    total: parseAmount(values.total),
    payment_method: (values.paymentMethod || null) as PaymentMethod | null,
    rnc: values.rnc.trim() || null,
    ncf: values.ncf.trim() || null,
    category: values.category as ExpenseCategory,
    notes: values.notes.trim() || null,
    status: options.status,
  }

  if (options.status === 'confirmed') {
    update.submitted_at = new Date().toISOString()
    if (options.isResubmission) {
      update.reviewed_by = null
      update.reviewed_at = null
      update.approval_comment = null
    }
  }

  return update
}

export function formItemsToRows(values: ExpenseFormValues) {
  return values.items
    .map((item, index) => {
      const quantity = parseAmount(item.quantity) ?? 1
      const unitPrice = parseAmount(item.unitPrice)
      return {
        description: item.description.trim(),
        quantity,
        unit_price: unitPrice,
        line_total: unitPrice === null ? null : roundMoney(quantity * unitPrice),
        position: index,
      }
    })
    .filter((item) => item.description.length > 0)
}

export function formTotalPreview(values: ExpenseFormValues): { subtotal: number; tax: number; tip: number; total: number } {
  const subtotal = parseAmount(values.subtotal) ?? 0
  const tax = parseAmount(values.tax) ?? 0
  const tip = parseAmount(values.tip) ?? 0
  const total = parseAmount(values.total) ?? roundMoney(subtotal + tax + tip)
  return { subtotal, tax, tip, total }
}

export function currencyOf(value: string): Currency {
  return value === 'USD' ? 'USD' : 'DOP'
}
