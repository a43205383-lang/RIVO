import { useCallback, useEffect, useState } from 'react'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { getMonthlySummary } from '@/features/expenses/api/expensesApi'
import { monthRange } from '@/shared/lib/date'
import { errorMessage } from '@/shared/lib/errors'
import type { Currency } from '@/shared/types/domain'
import type { MonthlySummary } from '@/features/expenses/types'

function cacheKey(month: string, currency: Currency, scopeAll: boolean) {
  return `rivo:cache:summary:${month}:${currency}:${scopeAll ? 'all' : 'mine'}`
}

export function useMonthlySummary({
  month,
  currency,
  scopeAll,
  enabled = true,
}: {
  month: string
  currency: Currency
  scopeAll: boolean
  enabled?: boolean
}) {
  const online = useOnlineStatus()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let active = true
    const range = monthRange(month)
    setLoading(true)
    setError(null)

    if (!online) {
      try {
        const raw = localStorage.getItem(cacheKey(month, currency, scopeAll))
        if (raw) {
          setSummary(JSON.parse(raw) as MonthlySummary)
          setError('Mostrando el último resumen guardado. Te falta conexión.')
        } else {
          setError('Sin conexión y sin resumen guardado para este mes.')
        }
      } catch {
        setError('Sin conexión y sin resumen guardado para este mes.')
      }
      setLoading(false)
      return
    }

    getMonthlySummary({ monthFrom: range.from, monthTo: range.to, currency, scopeAll })
      .then((result) => {
        if (!active) return
        setSummary(result)
        try {
          localStorage.setItem(cacheKey(month, currency, scopeAll), JSON.stringify(result))
        } catch {
          // ignore storage quota
        }
      })
      .catch((caught) => {
        if (!active) return
        setError(errorMessage(caught, 'No pudimos cargar el resumen del mes.'))
        try {
          const raw = localStorage.getItem(cacheKey(month, currency, scopeAll))
          if (raw) setSummary(JSON.parse(raw) as MonthlySummary)
        } catch {
          // ignore
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [month, currency, scopeAll, online, enabled, refreshKey])

  useEffect(() => {
    const handle = () => refresh()
    window.addEventListener('rivo:expenses-changed', handle)
    return () => window.removeEventListener('rivo:expenses-changed', handle)
  }, [refresh])

  return { summary, loading, error, refresh }
}
