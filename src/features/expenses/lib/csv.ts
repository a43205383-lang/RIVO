import { formatDate } from '@/shared/lib/date'
import { CATEGORY_CONFIG, PAYMENT_METHOD_LABELS, STATUS_CONFIG } from '@/features/expenses/constants'
import type { ExpenseWithRelations } from '@/features/expenses/types'

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function money(value: number | null): string {
  return value === null ? '' : value.toFixed(2)
}

export function csvDelimiter(): string {
  const language = typeof navigator === 'undefined' ? 'es' : navigator.language || 'es'
  return language.toLowerCase().startsWith('es') ? ';' : ','
}

export function buildExpensesCsv(expenses: ExpenseWithRelations[]): string {
  const delimiter = csvDelimiter()
  const headers = [
    'Fecha',
    'Comercio',
    'Categoría',
    'Estado',
    'Moneda',
    'Subtotal',
    'ITBIS',
    'Propina',
    'Total',
    'Método de pago',
    'RNC',
    'NCF',
    'Notas',
    'Ítems',
    'Creado',
  ]

  const rows = expenses.map((expense) => {
    const itemText = expense.items
      .map((item) => `${item.description} x${item.quantity}${item.line_total !== null ? ` = ${item.line_total}` : ''}`)
      .join(' | ')
    return [
      expense.expense_date ?? '',
      expense.merchant ?? '',
      CATEGORY_CONFIG[expense.category].label,
      STATUS_CONFIG[expense.status].label,
      expense.currency,
      money(expense.subtotal),
      money(expense.tax),
      money(expense.tip),
      money(expense.total),
      expense.payment_method ? PAYMENT_METHOD_LABELS[expense.payment_method] : '',
      expense.rnc ?? '',
      expense.ncf ?? '',
      expense.notes ?? '',
      itemText,
      expense.created_at ? formatDate(expense.created_at.slice(0, 10), 'numeric') : '',
    ]
  })

  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(delimiter))
  // BOM (UTF-8) so Excel renders accents correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
