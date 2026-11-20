import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { getExpense } from '@/features/expenses/api/expensesApi'
import { cacheExpense, readCachedExpense } from '@/features/expenses/lib/cache'
import { errorMessage } from '@/shared/lib/errors'
import type { ExpenseWithRelations } from '@/features/expenses/types'

export function useExpense(expenseId: string | undefined) {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [expense, setExpense] = useState<ExpenseWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const requestRef = useRef(0)

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  useEffect(() => {
    if (!expenseId || !user) {
      setLoading(false)
      return
    }
    const requestId = ++requestRef.current

    const fallback = (message: string | null) => {
      const cached = readCachedExpense(user.id, expenseId)
      if (cached) {
        setExpense(cached)
        setFromCache(true)
        setError(null)
      } else if (message) {
        setError(message)
      }
      setLoading(false)
    }

    if (!online) {
      fallback('No hay conexión y este gasto no está guardado en el dispositivo.')
      return
    }

    setLoading(true)
    setError(null)
    getExpense(expenseId)
      .then((result) => {
        if (requestRef.current !== requestId) return
        setExpense(result)
        setFromCache(false)
        cacheExpense(user.id, result)
      })
      .catch((caught) => {
        if (requestRef.current !== requestId) return
        fallback(errorMessage(caught, 'No pudimos cargar el gasto.'))
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false)
      })
  }, [expenseId, user, online, refreshKey])

  return { expense, loading, error, fromCache, refresh, setExpense }
}
