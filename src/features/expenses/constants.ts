import type { ExpenseCategory, ExpenseStatus, PaymentMethod } from '@/shared/types/domain'

type Tone = 'neutral' | 'brand' | 'sun' | 'berry' | 'sky' | 'outline' | 'dark'

export const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; tone: Tone; description: string }> = {
  alimentos: { label: 'Alimentos', tone: 'sun', description: 'Comidas, supermercado y cafetería' },
  combustible: { label: 'Combustible', tone: 'berry', description: 'Gasolina, gasoil y peajes' },
  transporte: { label: 'Transporte', tone: 'sky', description: 'Taxi, motoconcho y pasajes' },
  oficina: { label: 'Oficina', tone: 'brand', description: 'Papelería y suministros' },
  servicios: { label: 'Servicios', tone: 'outline', description: 'Luz, agua, internet y telefonía' },
  otros: { label: 'Otros', tone: 'neutral', description: 'Gastos no clasificados' },
}

export const STATUS_CONFIG: Record<
  ExpenseStatus,
  { label: string; tone: Tone; description: string; counts: boolean }
> = {
  draft: {
    label: 'Borrador',
    tone: 'neutral',
    description: 'Aún no se ha enviado a revisión',
    counts: false,
  },
  needs_review: {
    label: 'Requiere revisión',
    tone: 'sun',
    description: 'La IA no pudo extraer datos confiables',
    counts: false,
  },
  confirmed: {
    label: 'Confirmado',
    tone: 'sky',
    description: 'Esperando aprobación de contabilidad',
    counts: false,
  },
  approved: {
    label: 'Aprobado',
    tone: 'brand',
    description: 'Aprobado por contabilidad; cuenta en los totales',
    counts: true,
  },
  rejected: {
    label: 'Rechazado',
    tone: 'berry',
    description: 'Contabilidad pidió corregirlo',
    counts: false,
  },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export const CURRENCY_LABELS = {
  DOP: 'DOP · Peso dominicano',
  USD: 'USD · Dólar',
} as const

export const EXPENSE_PAGE_SIZE = 20

export const CATEGORY_ORDER: ExpenseCategory[] = [
  'alimentos',
  'combustible',
  'transporte',
  'oficina',
  'servicios',
  'otros',
]
