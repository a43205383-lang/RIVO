import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { listExpenses } from '@/features/expenses/api/expensesApi'
import { applyFiltersLocally } from '@/features/expenses/lib/filters'
import { readCachedExpenses, sortExpensesNewestFirst } from '@/features/expenses/lib/cache'
import { errorMessage } from '@/shared/lib/errors'
import type { ExpenseFilters, ExpenseWithRelations } from '@/features/expenses/types'
import { EXPENSE_PAGE_SIZE } from '@/features/expenses/constants'

export function useExpenses(filters: ExpenseFilters, pageSize = EXPENSE_PAGE_SIZE) {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const pageRef = useRef(0)
  const requestRef = useRef(0)

  const loadFromCache = useCallback(
    (reason: string | null) => {
      if (!user) return
      const cached = applyFiltersLocally(readCachedExpenses(user.id), filters)
      setExpenses(cached)
      setTotal(cached.length)
      setHasMore(false)
      setFromCache(true)
      setLoading(false)
      if (cached.length === 0 && reason) setError(reason)
      else setError(null)
    },
    [user, filters],
  )

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])
  const removeLocal = useCallback((expenseId: string) => {
    setExpenses((current) => current.filter((expense) => expense.id !== expenseId))
    setTotal((current) => Math.max(0, current - 1))
  }, [])

  useEffect(() => {
    if (!user) return
    const requestId = ++requestRef.current
    pageRef.current = 0

    if (!online) {
      loadFromCache(null)
      return
    }

    setLoading(true)
    setError(null)
    listExpenses({ userId: user.id, filters, page: 0, pageSize })
      .then((result) => {
        if (requestRef.current !== requestId) return
        setExpenses(result.expenses)
        setTotal(result.total)
        setHasMore(result.hasMore)
        setFromCache(false)
      })
      .catch((caught) => {
        if (requestRef.current !== requestId) return
        const message = errorMessage(caught, 'No pudimos cargar los gastos.')
        loadFromCache(message)
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false)
      })
  }, [user, online, filters, pageSize, refreshKey, loadFromCache])

  useEffect(() => {
    const handleChange = () => refresh()
    window.addEventListener('rivo:expenses-changed', handleChange)
    return () => window.removeEventListener('rivo:expenses-changed', handleChange)
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!user || !online || loadingMore || !hasMore) return
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const result = await listExpenses({ userId: user.id, filters, page: nextPage, pageSize })
      pageRef.current = nextPage
      setExpenses((current) => {
        const seen = new Set(current.map((expense) => expense.id))
        return sortExpensesNewestFirst([
          ...current,
          ...result.expenses.filter((expense) => !seen.has(expense.id)),
        ])
      })
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos cargar más gastos.'))
    } finally {
      setLoadingMore(false)
    }
  }, [user, online, loadingMore, hasMore, filters, pageSize])

  return {
    expenses,
    total,
    loading,
    loadingMore,
    error,
    fromCache,
    hasMore,
    refresh,
    loadMore,
    removeLocal,
  }
}
