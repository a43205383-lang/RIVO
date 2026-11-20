import type { ExpenseFilters, ExpenseWithRelations } from '@/features/expenses/types'

export function applyFiltersLocally(
  expenses: ExpenseWithRelations[],
  filters: ExpenseFilters,
): ExpenseWithRelations[] {
  const search = filters.search.trim().toLowerCase()
  return expenses.filter((expense) => {
    if (search) {
      const haystack = `${expense.merchant ?? ''} ${expense.rnc ?? ''} ${expense.ncf ?? ''}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (filters.category !== 'all' && expense.category !== filters.category) return false
    if (filters.status !== 'all' && expense.status !== filters.status) return false
    if (filters.currency !== 'all' && expense.currency !== filters.currency) return false
    if (filters.dateFrom && (!expense.expense_date || expense.expense_date < filters.dateFrom)) return false
    if (filters.dateTo && (!expense.expense_date || expense.expense_date > filters.dateTo)) return false
    return true
  })
}

export function activeFilterCount(filters: ExpenseFilters): number {
  let count = 0
  if (filters.search.trim()) count += 1
  if (filters.category !== 'all') count += 1
  if (filters.status !== 'all') count += 1
  if (filters.dateFrom) count += 1
  if (filters.dateTo) count += 1
  if (filters.currency !== 'all') count += 1
  return count
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return activeFilterCount(filters) > 0
}
