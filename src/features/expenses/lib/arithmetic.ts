import { parseAmount, roundMoney } from '@/shared/lib/money'
import type { ExpenseArithmetic, ExpenseFormValues } from '@/features/expenses/types'

const TOLERANCE = 0.05

export function checkArithmetic(values: ExpenseFormValues): ExpenseArithmetic {
  const subtotal = parseAmount(values.subtotal)
  const tax = parseAmount(values.tax)
  const tip = parseAmount(values.tip)
  const total = parseAmount(values.total)
  const missingFields: string[] = []

  if (total === null) missingFields.push('total')
  if (subtotal === null) missingFields.push('subtotal')
  if (tax === null) missingFields.push('ITBIS')
  if (tip === null) missingFields.push('propina')

  if (subtotal === null || total === null) {
    return {
      applicable: false,
      consistent: true,
      expectedTotal: null,
      difference: null,
      missingFields,
    }
  }

  const expectedTotal = roundMoney(subtotal + (tax ?? 0) + (tip ?? 0))
  const difference = roundMoney(total - expectedTotal)
  return {
    applicable: true,
    consistent: Math.abs(difference) <= TOLERANCE,
    expectedTotal,
    difference,
    missingFields,
  }
}

export function arithmeticMessage(arithmetic: ExpenseArithmetic): string {
  if (!arithmetic.applicable) {
    return 'Completa subtotal, ITBIS/propina y total para validar la aritmética.'
  }
  if (arithmetic.consistent) {
    return 'La suma cuadra con el total.'
  }
  const direction = (arithmetic.difference ?? 0) > 0 ? 'por encima' : 'por debajo'
  return `Subtotal + ITBIS + propina da ${arithmetic.expectedTotal?.toFixed(2)}; el total está ${direction} por ${Math.abs(
    arithmetic.difference ?? 0,
  ).toFixed(2)}. Revisa antes de confirmar.`
}
