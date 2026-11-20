import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Images, ReceiptText } from 'lucide-react'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/cn'
import { StatusBadge } from '@/features/expenses/components/StatusBadge'
import { CategoryBadge } from '@/features/expenses/components/CategoryBadge'
import type { ExpenseWithRelations } from '@/features/expenses/types'

export function ReceiptThumb({
  url,
  isPdf = false,
  className,
  alt = '',
}: {
  url?: string | null
  isPdf?: boolean
  className?: string
  alt?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!url || failed || isPdf) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-xl border border-line bg-canvas-deep text-ink-faint',
          className,
        )}
        aria-hidden
      >
        {isPdf ? <FileText className="size-5" /> : <ReceiptText className="size-5" />}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('rounded-xl border border-line bg-white object-cover', className)}
    />
  )
}

export function ExpenseCard({
  expense,
  thumbUrl,
  showOwner = false,
}: {
  expense: ExpenseWithRelations
  thumbUrl?: string | null
  showOwner?: boolean
}) {
  const firstImage = expense.images[0]
  const isPdf = firstImage?.mime_type === 'application/pdf'
  const extraImages = Math.max(0, expense.images.length - 1)

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="card group flex items-center gap-3 p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_36px_-24px_rgba(15,61,51,0.35)] sm:p-4"
    >
      <div className="relative shrink-0">
        <ReceiptThumb
          url={thumbUrl}
          isPdf={isPdf}
          alt={expense.merchant ? `Recibo de ${expense.merchant}` : 'Recibo'}
          className="size-14 sm:size-16"
        />
        {extraImages > 0 && (
          <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-0.5 rounded-full border-2 border-surface bg-brand-800 px-1.5 py-0.5 text-[0.5625rem] font-bold text-white">
            <Images className="size-2.5" aria-hidden />
            {extraImages + 1}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-bold text-ink">
              {expense.merchant?.trim() || 'Gasto sin comercio'}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {formatDate(expense.expense_date ?? expense.created_at.slice(0, 10))}
              {showOwner && expense.owner ? ` · ${expense.owner.full_name || expense.owner.email}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular text-[0.9375rem] font-bold text-ink">
              {formatMoney(expense.total, expense.currency)}
            </p>
            <p className="text-[0.625rem] font-semibold text-ink-faint">{expense.currency}</p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <CategoryBadge category={expense.category} />
            <StatusBadge status={expense.status} />
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  )
}
