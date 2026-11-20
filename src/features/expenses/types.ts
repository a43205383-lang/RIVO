import type { ExpenseCategory, ExpenseStatus, PaymentMethod, Currency } from '@/shared/types/domain'
import type { ExpenseImageRow, ExpenseItemRow, ExpenseRow } from '@/shared/types/database.types'

export interface ExpenseWithRelations extends ExpenseRow {
  images: ExpenseImageRow[]
  items: ExpenseItemRow[]
  reviewer?: { id: string; full_name: string; email: string } | null
  owner?: { id: string; full_name: string; email: string } | null
}

export interface ExpenseFilters {
  search: string
  category: ExpenseCategory | 'all'
  status: ExpenseStatus | 'all'
  dateFrom: string
  dateTo: string
  currency: Currency | 'all'
}

export const emptyExpenseFilters: ExpenseFilters = {
  search: '',
  category: 'all',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  currency: 'all',
}

export interface ExpenseListItem extends ExpenseWithRelations {
  thumbUrl?: string | null
  imageUrl?: string | null
}

export interface ExpenseFormItem {
  key: string
  description: string
  quantity: string
  unitPrice: string
}

export interface ExpenseFormValues {
  merchant: string
  expenseDate: string
  currency: Currency
  subtotal: string
  tax: string
  tip: string
  total: string
  paymentMethod: PaymentMethod | ''
  rnc: string
  ncf: string
  category: ExpenseCategory
  notes: string
  items: ExpenseFormItem[]
}

export interface ExpenseArithmetic {
  applicable: boolean
  consistent: boolean
  expectedTotal: number | null
  difference: number | null
  missingFields: string[]
}

export interface DuplicateMatch {
  id: string
  merchant: string | null
  expense_date: string | null
  total: number | null
  status: ExpenseStatus
  reason: 'image' | 'fields'
}

export interface MonthlySummary {
  month: string
  currency: Currency
  total: number
  count: number
  pendingTotal: number
  pendingCount: number
  byCategory: Array<{ category: ExpenseCategory; total: number; count: number }>
}
