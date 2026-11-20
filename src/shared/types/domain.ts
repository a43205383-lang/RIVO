export type UserRole = 'employee' | 'accountant'

export type ExpenseStatus = 'draft' | 'needs_review' | 'confirmed' | 'approved' | 'rejected'

export type ExpenseCategory = 'alimentos' | 'combustible' | 'transporte' | 'oficina' | 'servicios' | 'otros'

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'

export type Currency = 'DOP' | 'USD'

export const USER_ROLES = ['employee', 'accountant'] as const satisfies readonly UserRole[]
export const EXPENSE_STATUSES = [
  'draft',
  'needs_review',
  'confirmed',
  'approved',
  'rejected',
] as const satisfies readonly ExpenseStatus[]
export const EXPENSE_CATEGORIES = [
  'alimentos',
  'combustible',
  'transporte',
  'oficina',
  'servicios',
  'otros',
] as const satisfies readonly ExpenseCategory[]
export const PAYMENT_METHODS = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'otro',
] as const satisfies readonly PaymentMethod[]
export const CURRENCIES = ['DOP', 'USD'] as const satisfies readonly Currency[]
