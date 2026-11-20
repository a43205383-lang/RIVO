import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { findDuplicates } from '@/features/expenses/api/expensesApi'
import type { DuplicateMatch } from '@/features/expenses/types'

export function useDuplicateCheck({
  merchant,
  expenseDate,
  total,
  imageHash,
  excludeId,
  enabled = true,
}: {
  merchant: string
  expenseDate: string
  total: number | null
  imageHash?: string | null
  excludeId?: string
  enabled?: boolean
}) {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [checking, setChecking] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!enabled || !user || !online) {
      setDuplicates([])
      setChecking(false)
      return
    }
    const hasFields = Boolean(merchant.trim() && expenseDate && total !== null)
    if (!hasFields && !imageHash) {
      setDuplicates([])
      return
    }
    const timer = window.setTimeout(() => {
      const requestId = ++requestRef.current
      setChecking(true)
      findDuplicates({
        userId: user.id,
        merchant,
        expenseDate,
        total,
        imageHash,
        excludeId,
      })
        .then((result) => {
          if (requestRef.current === requestId) setDuplicates(result)
        })
        .catch(() => undefined)
        .finally(() => {
          if (requestRef.current === requestId) setChecking(false)
        })
    }, 600)

    return () => window.clearTimeout(timer)
  }, [merchant, expenseDate, total, imageHash, excludeId, enabled, user, online])

  return { duplicates, checking }
}
