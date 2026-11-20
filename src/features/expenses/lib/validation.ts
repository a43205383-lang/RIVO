import type { Currency, ExpenseCategory, PaymentMethod } from '@/shared/types/domain'
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/shared/types/domain'
import { isValidDateOnly } from '@/shared/lib/date'
import { parseAmount } from '@/shared/lib/money'
import type { ExpenseFormValues } from '@/features/expenses/types'

export type FormMode = 'draft' | 'confirm'

export type ExpenseFormErrors = Record<string, string>

function validateAmount(value: string, label: string, errors: ExpenseFormErrors, key: string, required: boolean) {
  const trimmed = value.trim()
  if (!trimmed) {
    if (required) errors[key] = `${label} es obligatorio.`
    return
  }
  const amount = parseAmount(trimmed)
  if (amount === null) {
    errors[key] = `${label} debe ser un número válido.`
    return
  }
  if (amount < 0) errors[key] = `${label} no puede ser negativo.`
  if (amount > 999_999_999) errors[key] = `${label} excede el máximo permitido.`
}

export function expenseFormErrors(values: ExpenseFormValues, mode: FormMode): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {}
  const merchant = values.merchant.trim()
  const required = mode === 'confirm'

  if (required && !merchant) errors.merchant = 'El comercio es obligatorio para confirmar.'
  if (merchant.length > 160) errors.merchant = 'Máximo 160 caracteres.'

  if (!values.expenseDate) {
    if (required) errors.expenseDate = 'La fecha es obligatoria para confirmar.'
  } else if (!isValidDateOnly(values.expenseDate)) {
    errors.expenseDate = 'Usa una fecha válida.'
  }

  if (!CURRENCIES.includes(values.currency)) errors.currency = 'Moneda inválida.'

  validateAmount(values.subtotal, 'El subtotal', errors, 'subtotal', false)
  validateAmount(values.tax, 'El ITBIS', errors, 'tax', false)
  validateAmount(values.tip, 'La propina', errors, 'tip', false)
  validateAmount(values.total, 'El total', errors, 'total', required)

  if (values.paymentMethod && !PAYMENT_METHODS.includes(values.paymentMethod as PaymentMethod)) {
    errors.paymentMethod = 'Forma de pago inválida.'
  }
  if (!EXPENSE_CATEGORIES.includes(values.category as ExpenseCategory)) {
    errors.category = 'Categoría inválida.'
  }
  if (values.rnc.trim().length > 30) errors.rnc = 'Máximo 30 caracteres.'
  if (values.ncf.trim().length > 30) errors.ncf = 'Máximo 30 caracteres.'
  if (values.notes.length > 2_000) errors.notes = 'Máximo 2,000 caracteres.'

  values.items.forEach((item, index) => {
    const hasAny = item.description.trim() || item.quantity.trim() || item.unitPrice.trim()
    if (!hasAny) return
    if (!item.description.trim()) errors[`items.${index}.description`] = 'Describe el ítem.'
    const quantity = parseAmount(item.quantity)
    if (quantity === null || quantity <= 0) errors[`items.${index}.quantity`] = 'Cantidad mayor que 0.'
    const unitPrice = item.unitPrice.trim() ? parseAmount(item.unitPrice) : null
    if (item.unitPrice.trim() && (unitPrice === null || unitPrice < 0)) {
      errors[`items.${index}.unitPrice`] = 'Precio inválido.'
    }
    if (item.description.length > 200) errors[`items.${index}.description`] = 'Máximo 200 caracteres.'
  })

  return errors
}

export function firstFormError(errors: ExpenseFormErrors): string | null {
  const first = Object.values(errors)[0]
  return first ?? null
}

export function currencyLabel(currency: Currency): string {
  return currency === 'USD' ? 'USD' : 'DOP'
}
