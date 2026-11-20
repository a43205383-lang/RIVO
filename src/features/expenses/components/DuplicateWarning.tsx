import { Link } from 'react-router-dom'
import { CopyCheck, LoaderCircle } from 'lucide-react'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { STATUS_CONFIG } from '@/features/expenses/constants'
import type { DuplicateMatch } from '@/features/expenses/types'

export function DuplicateWarning({
  duplicates,
  checking,
}: {
  duplicates: DuplicateMatch[]
  checking: boolean
}) {
  if (!checking && duplicates.length === 0) return null

  return (
    <div className="rounded-xl border border-sun-300 bg-sun-50 px-3.5 py-3 text-sun-800" role="status">
      <div className="flex items-start gap-2">
        {checking ? (
          <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <CopyCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            {checking ? 'Buscando posibles duplicados…' : 'Posible gasto duplicado'}
          </p>
          {duplicates.length > 0 && (
            <>
              <p className="mt-0.5 text-xs leading-relaxed">
                Ya existe un gasto con {duplicates[0].reason === 'image' ? 'la misma imagen' : 'el mismo comercio, fecha y total'}.
                Puedes guardarlo igual si estás seguro.
              </p>
              <ul className="mt-2 space-y-1.5">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <Link
                      to={`/expenses/${duplicate.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-sun-200 bg-white/60 px-2.5 py-1.5 text-[0.6875rem] transition-colors hover:bg-white"
                    >
                      <span className="truncate font-semibold">
                        {duplicate.merchant || 'Sin comercio'} · {formatDate(duplicate.expense_date)}
                      </span>
                      <span className="tabular shrink-0 font-bold">{formatMoney(duplicate.total)}</span>
                      <span className="shrink-0 text-sun-600">{STATUS_CONFIG[duplicate.status].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
