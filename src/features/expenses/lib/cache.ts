import type { ExpenseWithRelations } from '@/features/expenses/types'

const MAX_CACHED = 200

function listKey(userId: string) {
  return `rivo:cache:expenses:${userId}`
}

function detailKey(userId: string, expenseId: string) {
  return `rivo:cache:expense:${userId}:${expenseId}`
}

export function readCachedExpenses(userId: string): ExpenseWithRelations[] {
  try {
    const raw = localStorage.getItem(listKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { items?: ExpenseWithRelations[] }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

export function mergeCachedExpenses(userId: string, items: ExpenseWithRelations[]) {
  try {
    const existing = readCachedExpenses(userId)
    const map = new Map(existing.map((expense) => [expense.id, expense]))
    for (const expense of items) map.set(expense.id, expense)
    const merged = [...map.values()]
      .sort((a, b) => {
        const aDate = a.expense_date ?? a.created_at.slice(0, 10)
        const bDate = b.expense_date ?? b.created_at.slice(0, 10)
        if (aDate === bDate) return b.created_at.localeCompare(a.created_at)
        return bDate.localeCompare(aDate)
      })
      .slice(0, MAX_CACHED)
    localStorage.setItem(listKey(userId), JSON.stringify({ updatedAt: Date.now(), items: merged }))
  } catch {
    // Private mode / storage full: the online experience still works.
  }
}

export function readCachedExpense(userId: string, expenseId: string): ExpenseWithRelations | null {
  try {
    const raw = localStorage.getItem(detailKey(userId, expenseId))
    if (raw) return JSON.parse(raw) as ExpenseWithRelations
  } catch {
    // ignore
  }
  return readCachedExpenses(userId).find((expense) => expense.id === expenseId) ?? null
}

export function cacheExpense(userId: string, expense: ExpenseWithRelations) {
  try {
    localStorage.setItem(detailKey(userId, expense.id), JSON.stringify(expense))
  } catch {
    // ignore
  }
  mergeCachedExpenses(userId, [expense])
}

export function removeCachedExpense(userId: string, expenseId: string) {
  try {
    localStorage.removeItem(detailKey(userId, expenseId))
    const remaining = readCachedExpenses(userId).filter((expense) => expense.id !== expenseId)
    localStorage.setItem(listKey(userId), JSON.stringify({ updatedAt: Date.now(), items: remaining }))
  } catch {
    // ignore
  }
}

export function clearExpenseCache(userId: string) {
  try {
    localStorage.removeItem(listKey(userId))
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(`rivo:cache:expense:${userId}:`)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}
