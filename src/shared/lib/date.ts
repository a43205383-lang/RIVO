const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !DATE_ONLY.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): string {
  return toDateOnly(new Date())
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const last = new Date(year, monthIndex, 0)
  return { from: toDateOnly(first), to: toDateOnly(last) }
}

export function monthLabel(month: string, short = false): string {
  const [year, monthIndex] = month.split('-').map(Number)
  if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) return month
  const name = short ? MONTHS_SHORT[monthIndex - 1] : MONTHS_LONG[monthIndex - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

export function formatDate(value: string | null | undefined, variant: 'short' | 'long' | 'numeric' = 'short'): string {
  const date = parseDateOnly(value)
  if (!date) return '—'
  if (variant === 'numeric') {
    return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  }
  const day = date.getDate()
  const month = variant === 'long' ? MONTHS_LONG[date.getMonth()] : MONTHS_SHORT[date.getMonth()]
  return `${day} ${month} ${date.getFullYear()}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function relativeExpenseDate(value: string | null | undefined): string {
  const date = parseDateOnly(value)
  if (!date) return 'Sin fecha'
  const today = parseDateOnly(todayISO())!
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} días`
  return formatDate(value)
}

export function daysInMonth(month: string): number {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex, 0).getDate()
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(year, monthIndex - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null
}
