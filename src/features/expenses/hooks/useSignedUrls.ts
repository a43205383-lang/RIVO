import { useEffect, useState } from 'react'
import { getSignedUrls } from '@/features/expenses/api/storageApi'

export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const key = [...new Set(paths.filter(Boolean))].sort().join('|')

  useEffect(() => {
    const unique = key ? key.split('|') : []
    if (unique.length === 0) {
      setUrls({})
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    getSignedUrls(unique)
      .then((result) => {
        if (active) setUrls((current) => ({ ...current, ...result }))
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [key])

  return { urls, loading }
}
