import type { Currency } from '@/shared/types/domain'

const LOCALE = 'es-DO'

export function formatMoney(value: number | null | undefined, currency: Currency = 'DOP'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMoneyPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(LOCALE).format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 }).format(value)
}

export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCompactMoney(value: number, currency: Currency = 'DOP'): string {
  if (Math.abs(value) < 10_000) return formatMoney(value, currency)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
