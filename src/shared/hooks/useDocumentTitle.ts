import { useEffect } from 'react'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Rivo` : 'Rivo — Gastos claros'
  }, [title])
}
