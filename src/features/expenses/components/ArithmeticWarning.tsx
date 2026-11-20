import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { arithmeticMessage } from '@/features/expenses/lib/arithmetic'
import { formatMoney } from '@/shared/lib/money'
import type { ExpenseArithmetic } from '@/features/expenses/types'
import type { Currency } from '@/shared/types/domain'

export function ArithmeticWarning({
  arithmetic,
  currency,
  showSuccess = false,
}: {
  arithmetic: ExpenseArithmetic
  currency: Currency
  showSuccess?: boolean
}) {
  if (!arithmetic.applicable) return null

  if (arithmetic.consistent) {
    if (!showSuccess) return null
    return (
      <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>La aritmética cuadra: subtotal + ITBIS + propina = total.</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-sun-300 bg-sun-50 px-3.5 py-3 text-sun-800" role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-xs font-bold">Los números no cuadran</p>
          <p className="mt-0.5 text-xs leading-relaxed">{arithmeticMessage(arithmetic)}</p>
          <p className="mt-1 text-[0.6875rem] font-semibold">
            Esperado: {formatMoney(arithmetic.expectedTotal, currency)} · Registrado:{' '}
            {formatMoney((arithmetic.expectedTotal ?? 0) + (arithmetic.difference ?? 0), currency)}
          </p>
        </div>
      </div>
    </div>
  )
}
