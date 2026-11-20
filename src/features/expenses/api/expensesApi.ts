import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'
import { normalizeMerchant } from '@/shared/lib/text'
import { formatDate } from '@/shared/lib/date'
import type {
  ExpenseImageRow,
  ExpenseItemRow,
  ExpenseRow,
  ExpenseUpdate,
  ProfileRow,
} from '@/shared/types/database.types'
import type { ExpenseStatus, Currency } from '@/shared/types/domain'
import type {
  DuplicateMatch,
  ExpenseFilters,
  ExpenseWithRelations,
  MonthlySummary,
} from '@/features/expenses/types'
import { mergeCachedExpenses, removeCachedExpense, cacheExpense } from '@/features/expenses/lib/cache'
import { errorMessage } from '@/shared/lib/errors'

const EXPENSE_SELECT = `
  *,
  images:expense_images(*),
  items:expense_items(*),
  owner:profiles!expenses_user_id_fkey(id, full_name, email),
  reviewer:profiles!expenses_reviewed_by_fkey(id, full_name, email)
`

function throwIfError(error: PostgrestError | null, fallback?: string) {
  if (error) throw new Error(errorMessage(error, fallback))
}

function likeEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function normalizeExpense(row: unknown): ExpenseWithRelations {
  const record = row as ExpenseWithRelations & {
    images?: ExpenseImageRow[] | null
    items?: ExpenseItemRow[] | null
    owner?: ExpenseWithRelations['owner'] | null
    reviewer?: ExpenseWithRelations['reviewer'] | null
  }
  return {
    ...record,
    images: [...(record.images ?? [])].sort((a, b) => a.position - b.position),
    items: [...(record.items ?? [])].sort((a, b) => a.position - b.position),
    owner: record.owner ?? null,
    reviewer: record.reviewer ?? null,
  }
}

export interface ListExpensesParams {
  userId: string
  filters: ExpenseFilters
  page?: number
  pageSize?: number
}

export interface ListExpensesResult {
  expenses: ExpenseWithRelations[]
  total: number
  hasMore: boolean
}

export async function listExpenses({
  userId,
  filters,
  page = 0,
  pageSize = 20,
}: ListExpensesParams): Promise<ListExpensesResult> {
  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT, { count: 'exact' })
    .order('expense_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (filters.search.trim()) {
    query = query.ilike('merchant', `%${likeEscape(filters.search.trim())}%`)
  }
  if (filters.category !== 'all') query = query.eq('category', filters.category)
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.currency !== 'all') query = query.eq('currency', filters.currency)
  if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)

  const offset = page * pageSize
  const { data, error, count } = await query.range(offset, offset + pageSize - 1)
  throwIfError(error, 'No pudimos cargar los gastos.')

  const expenses = (data ?? []).map(normalizeExpense)
  mergeCachedExpenses(userId, expenses)
  const total = count ?? expenses.length
  return { expenses, total, hasMore: offset + expenses.length < total }
}

export async function listAllExpenses(filters: ExpenseFilters, max = 1000): Promise<ExpenseWithRelations[]> {
  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .order('expense_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(max)

  if (filters.search.trim()) query = query.ilike('merchant', `%${likeEscape(filters.search.trim())}%`)
  if (filters.category !== 'all') query = query.eq('category', filters.category)
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.currency !== 'all') query = query.eq('currency', filters.currency)
  if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)

  const { data, error } = await query
  throwIfError(error, 'No pudimos preparar la exportación.')
  return (data ?? []).map(normalizeExpense)
}

export async function getExpense(expenseId: string): Promise<ExpenseWithRelations> {
  const { data, error } = await supabase.from('expenses').select(EXPENSE_SELECT).eq('id', expenseId).single()
  throwIfError(error, 'No pudimos cargar el gasto.')
  return normalizeExpense(data)
}

export async function createExpenseShell(expenseId: string, userId: string): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      id: expenseId,
      user_id: userId,
      status: 'draft',
      currency: 'DOP',
      category: 'otros',
    })
    .select('*')
    .single()
  throwIfError(error, 'No pudimos crear el gasto.')
  if (!data) throw new Error('No pudimos crear el gasto.')
  return data
}

export async function updateExpense(expenseId: string, patch: ExpenseUpdate): Promise<ExpenseWithRelations> {
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', expenseId).select(EXPENSE_SELECT).single()
  throwIfError(error, 'No pudimos guardar los cambios.')
  return normalizeExpense(data)
}

export async function replaceExpenseItems(
  expenseId: string,
  items: Array<{ description: string; quantity: number; unit_price: number | null; line_total: number | null; position: number }>,
) {
  const { error: deleteError } = await supabase.from('expense_items').delete().eq('expense_id', expenseId)
  throwIfError(deleteError, 'No pudimos actualizar los ítems.')
  if (items.length === 0) return
  const { error } = await supabase.from('expense_items').insert(
    items.map((item) => ({
      id: crypto.randomUUID(),
      expense_id: expenseId,
      ...item,
    })),
  )
  throwIfError(error, 'No pudimos guardar los ítems.')
}

export async function saveExpense(params: {
  expenseId: string
  patch: ExpenseUpdate
  items: Array<{ description: string; quantity: number; unit_price: number | null; line_total: number | null; position: number }>
  userId: string
}): Promise<ExpenseWithRelations> {
  await updateExpense(params.expenseId, params.patch)
  await replaceExpenseItems(params.expenseId, params.items)
  const expense = await getExpense(params.expenseId)
  cacheExpense(params.userId, expense)
  return expense
}

export async function approveExpense(expenseId: string, comment: string): Promise<void> {
  const { error } = await supabase.rpc('approve_expense', {
    p_expense_id: expenseId,
    p_comment: comment.trim() || null,
  })
  throwIfError(error, 'No pudimos aprobar el gasto.')
}

export async function rejectExpense(expenseId: string, comment: string): Promise<void> {
  const { error } = await supabase.rpc('reject_expense', {
    p_expense_id: expenseId,
    p_comment: comment.trim(),
  })
  throwIfError(error, 'No pudimos rechazar el gasto.')
}

export async function listPendingApprovals(): Promise<ExpenseWithRelations[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('status', 'confirmed')
    .order('submitted_at', { ascending: true })
    .limit(200)
  throwIfError(error, 'No pudimos cargar las aprobaciones.')
  return (data ?? []).map(normalizeExpense)
}

export async function countPendingApprovals(): Promise<number> {
  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
  throwIfError(error, 'No pudimos contar las aprobaciones.')
  return count ?? 0
}

export async function deleteExpense(expense: ExpenseWithRelations): Promise<void> {
  const paths = expense.images.flatMap((image) => [image.storage_path, image.thumb_path].filter(Boolean) as string[])
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(env.storageBucket).remove(paths)
    if (storageError) throw new Error(errorMessage(storageError, 'No pudimos borrar las fotos del recibo.'))
  }
  const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
  throwIfError(error, 'No pudimos eliminar el gasto.')
  removeCachedExpense(expense.user_id, expense.id)
}

export async function findDuplicates(params: {
  userId: string
  merchant: string
  expenseDate: string
  total: number | null
  imageHash?: string | null
  excludeId?: string
}): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>()

  if (params.imageHash) {
    const { data, error } = await supabase
      .from('expense_images')
      .select('expense_id, expenses!inner(id, merchant, expense_date, total, status, user_id)')
      .eq('image_hash', params.imageHash)
    if (!error && data) {
      for (const row of data as unknown as Array<{
        expense_id: string
        expenses: Pick<ExpenseRow, 'id' | 'merchant' | 'expense_date' | 'total' | 'status' | 'user_id'> | null
      }>) {
        const expense = row.expenses
        if (!expense || expense.user_id !== params.userId) continue
        if (params.excludeId && expense.id === params.excludeId) continue
        matches.set(expense.id, {
          id: expense.id,
          merchant: expense.merchant,
          expense_date: expense.expense_date,
          total: expense.total,
          status: expense.status,
          reason: 'image',
        })
      }
    }
  }

  if (params.merchant.trim() && params.expenseDate && params.total !== null) {
    let query = supabase
      .from('expenses')
      .select('id, merchant, expense_date, total, status')
      .eq('user_id', params.userId)
      .eq('merchant_normalized', normalizeMerchant(params.merchant))
      .eq('expense_date', params.expenseDate)
      .eq('total', params.total)
      .limit(5)
    if (params.excludeId) query = query.neq('id', params.excludeId)
    const { data, error } = await query
    if (!error && data) {
      for (const expense of data) {
        if (!matches.has(expense.id)) {
          matches.set(expense.id, {
            id: expense.id,
            merchant: expense.merchant,
            expense_date: expense.expense_date,
            total: expense.total,
            status: expense.status,
            reason: 'fields',
          })
        }
      }
    }
  }

  return [...matches.values()].slice(0, 5)
}

export async function getMonthlySummary(params: {
  monthFrom: string
  monthTo: string
  currency: Currency
  scopeAll: boolean
}): Promise<MonthlySummary> {
  const { data, error } = await supabase.rpc('get_monthly_summary', {
    p_from: params.monthFrom,
    p_to: params.monthTo,
    p_currency: params.currency,
    p_scope_all: params.scopeAll,
  })
  throwIfError(error, 'No pudimos calcular el resumen.')
  const record = (data ?? {}) as {
    total?: number
    count?: number
    pending_total?: number
    pending_count?: number
    categories?: Array<{ category: MonthlySummary['byCategory'][number]['category']; total: number; count: number }>
  }
  return {
    month: params.monthFrom.slice(0, 7),
    currency: params.currency,
    total: Number(record.total ?? 0),
    count: Number(record.count ?? 0),
    pendingTotal: Number(record.pending_total ?? 0),
    pendingCount: Number(record.pending_count ?? 0),
    byCategory: (record.categories ?? []).map((item) => ({
      category: item.category,
      total: Number(item.total ?? 0),
      count: Number(item.count ?? 0),
    })),
  }
}

export async function updateStatus(expenseId: string, status: ExpenseStatus): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
  throwIfError(error, 'No pudimos actualizar el estado.')
}

export function expenseSubtitle(expense: Pick<ExpenseRow, 'expense_date' | 'created_at'>): string {
  return formatDate(expense.expense_date ?? expense.created_at.slice(0, 10))
}

export function profileName(profile: Pick<ProfileRow, 'full_name' | 'email'> | null | undefined): string {
  return profile?.full_name?.trim() || profile?.email || 'Usuario'
}

export const expenseSelect = EXPENSE_SELECT
