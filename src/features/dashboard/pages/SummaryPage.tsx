import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  PieChart,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useMonthlySummary } from '@/features/expenses/hooks/useMonthlySummary'
import { listAllExpenses } from '@/features/expenses/api/expensesApi'
import { buildExpensesCsv } from '@/features/expenses/lib/csv'
import { CATEGORY_CONFIG } from '@/features/expenses/constants'
import { CategoryIcon } from '@/features/expenses/components/CategoryBadge'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button, buttonStyles } from '@/shared/components/ui/Button'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { SummarySkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import { useToast } from '@/shared/components/ui/Toast'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/money'
import { currentMonth, monthLabel, monthRange, shiftMonth } from '@/shared/lib/date'
import { downloadText } from '@/shared/lib/download'
import { errorMessage } from '@/shared/lib/errors'
import { cn } from '@/shared/lib/cn'
import type { Currency, ExpenseCategory } from '@/shared/types/domain'

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  alimentos: '#e8a93a',
  combustible: '#cf3f3f',
  transporte: '#49a5c5',
  oficina: '#0f705d',
  servicios: '#78c9b3',
  otros: '#b7ae9c',
}

export function SummaryPage() {
  useDocumentTitle('Resumen mensual')
  const { isAccountant } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [currency, setCurrency] = useState<Currency>('DOP')
  const [scopeAll, setScopeAll] = useState(isAccountant)
  const [exporting, setExporting] = useState(false)

  const { summary, loading, error, refresh } = useMonthlySummary({
    month,
    currency,
    scopeAll: isAccountant && scopeAll,
  })

  const categories = useMemo(
    () => [...(summary?.byCategory ?? [])].filter((item) => item.total > 0).sort((a, b) => b.total - a.total),
    [summary],
  )
  const total = summary?.total ?? 0
  const atCurrentMonth = month >= currentMonth()

  const handleExport = async () => {
    if (!online) {
      toast.error('Necesitas conexión para exportar los gastos del mes.')
      return
    }
    setExporting(true)
    try {
      const range = monthRange(month)
      const expenses = await listAllExpenses({
        search: '',
        category: 'all',
        status: 'approved',
        dateFrom: range.from,
        dateTo: range.to,
        currency,
      })
      if (expenses.length === 0) {
        toast.info('No hay gastos aprobados en este mes para exportar.')
        return
      }
      downloadText(
        buildExpensesCsv(expenses),
        `rivo-resumen-${month}-${currency.toLowerCase()}.csv`,
      )
      toast.success(`${expenses.length} gasto${expenses.length === 1 ? '' : 's'} aprobado${expenses.length === 1 ? '' : 's'} exportado${expenses.length === 1 ? '' : 's'}.`)
    } catch (caught) {
      toast.error(errorMessage(caught, 'No pudimos exportar el resumen.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Análisis"
        title="Resumen mensual"
        description="Solo los gastos aprobados cuentan. Los confirmados aparecen aparte como pendientes."
        actions={
          <Button
            variant="secondary"
            onClick={() => void handleExport()}
            loading={exporting}
            icon={<Download className="size-4" />}
          >
            <span className="hidden sm:inline">Exportar aprobados</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMonth((value) => shiftMonth(value, -1))}
              className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-[9.5rem] px-2 text-center">
              <p className="font-display text-base font-bold text-ink">{monthLabel(month)}</p>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-faint">
                {isAccountant && scopeAll ? 'Todo el equipo' : 'Mis gastos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMonth((value) => shiftMonth(value, 1))}
              disabled={atCurrentMonth}
              className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink disabled:opacity-40"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-line bg-canvas/60 p-0.5" role="group" aria-label="Moneda">
              {(['DOP', 'USD'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCurrency(option)}
                  className={cn(
                    'min-h-8 rounded-lg px-3 text-xs font-bold transition-colors',
                    currency === option ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                  )}
                  aria-pressed={currency === option}
                >
                  {option}
                </button>
              ))}
            </div>

            {isAccountant && (
              <div className="inline-flex rounded-xl border border-line bg-canvas/60 p-0.5" role="group" aria-label="Alcance">
                <button
                  type="button"
                  onClick={() => setScopeAll(true)}
                  className={cn(
                    'min-h-8 rounded-lg px-3 text-xs font-bold transition-colors',
                    scopeAll ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                  )}
                  aria-pressed={scopeAll}
                >
                  Equipo
                </button>
                <button
                  type="button"
                  onClick={() => setScopeAll(false)}
                  className={cn(
                    'min-h-8 rounded-lg px-3 text-xs font-bold transition-colors',
                    !scopeAll ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                  )}
                  aria-pressed={!scopeAll}
                >
                  Solo yo
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={refresh}
              disabled={!online}
              className="flex size-9 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-canvas-deep hover:text-ink disabled:opacity-40"
              aria-label="Actualizar resumen"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Sin conexión: mostramos el último resumen guardado para este mes y moneda.</span>
        </div>
      )}

      {loading && !summary ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <SummarySkeleton />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : error && !summary ? (
        <ErrorState
          title="No pudimos calcular el resumen"
          description={error}
          onRetry={refresh}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <section className="card overflow-hidden">
              <div className="bg-brand-950 px-5 py-6 text-white sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-brand-200">
                    Total aprobado
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[0.625rem] font-bold text-brand-100">
                    <ShieldCheck className="size-3" aria-hidden />
                    {currency}
                  </span>
                </div>
                <p className="tabular mt-3 font-display text-[2.6rem] font-bold leading-none tracking-[-0.04em]">
                  {formatMoney(total, currency)}
                </p>
                <p className="mt-2 text-xs text-brand-200">
                  {formatNumber(summary?.count ?? 0)} gasto{(summary?.count ?? 0) === 1 ? '' : 's'} aprobado
                  {(summary?.count ?? 0) === 1 ? '' : 's'} en {monthLabel(month, true)}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-brand-200">
                      <Clock3 className="size-3" aria-hidden />
                      Pendiente
                    </p>
                    <p className="tabular mt-1 text-sm font-bold">
                      {formatMoney(summary?.pendingTotal ?? 0, currency)}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] text-brand-200">
                      {formatNumber(summary?.pendingCount ?? 0)} confirmado
                      {(summary?.pendingCount ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-brand-200">
                      <PieChart className="size-3" aria-hidden />
                      Categorías
                    </p>
                    <p className="tabular mt-1 text-sm font-bold">{formatNumber(categories.length)}</p>
                    <p className="mt-0.5 text-[0.625rem] text-brand-200">con gasto aprobado</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                {(summary?.pendingCount ?? 0) > 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
                    <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                      Hay {formatNumber(summary?.pendingCount ?? 0)} gasto
                      {(summary?.pendingCount ?? 0) === 1 ? '' : 's'} esperando aprobación por{' '}
                      {formatMoney(summary?.pendingTotal, currency)}. No se incluyen en el total.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
                    <ShieldCheck className="size-4 shrink-0" aria-hidden />
                    <p>No hay gastos pendientes de aprobación en {monthLabel(month, true)}.</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/expenses" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                    Ver gastos
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                  {isAccountant && (
                    <Link to="/approvals" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                      Aprobaciones
                    </Link>
                  )}
                </div>
              </div>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-base font-bold tracking-tight text-ink">
                Distribución por categoría
              </h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Porcentaje del total aprobado en {currency}.
              </p>

              {categories.length === 0 ? (
                <EmptyState
                  icon={<PieChart className="size-7" />}
                  title="Sin datos aprobados"
                  description={
                    total === 0
                      ? 'Cuando contabilidad apruebe gastos de este mes, verás aquí la distribución por categoría.'
                      : 'No hay categorías con monto para graficar.'
                  }
                  className="mt-4 border-0 bg-transparent px-2 py-8 shadow-none"
                  action={
                    <Link to="/capture" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                      <ReceiptText className="size-3.5" aria-hidden />
                      Capturar recibo
                    </Link>
                  }
                />
              ) : (
                <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-center">
                  <DonutChart categories={categories} total={total} currency={currency} />
                  <ul className="space-y-2.5">
                    {categories.map((category) => {
                      const percent = total > 0 ? category.total / total : 0
                      return (
                        <li key={category.category} className="flex items-center gap-2.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[category.category] }}
                            aria-hidden
                          />
                          <CategoryIcon category={category.category} className="size-3.5 text-ink-faint" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-ink">
                                {CATEGORY_CONFIG[category.category].label}
                              </span>
                              <span className="tabular shrink-0 text-xs font-bold text-ink">
                                {formatMoney(category.total, currency)}
                              </span>
                            </span>
                            <span className="mt-0.5 flex items-center justify-between gap-2 text-[0.625rem] text-ink-faint">
                              <span>
                                {formatNumber(category.count)} gasto{category.count === 1 ? '' : 's'}
                              </span>
                              <span>{formatPercent(percent)}</span>
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {error && summary && (
            <div className="mt-4 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
              {error}
            </div>
          )}

          <section className="card mt-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Barras del mes</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Comparación visual contra la categoría con mayor gasto aprobado.
                </p>
              </div>
              <span className="rounded-full bg-canvas-deep px-2.5 py-1 text-[0.625rem] font-bold text-ink-soft">
                {monthLabel(month, true)}
              </span>
            </div>
            {categories.length === 0 ? (
              <p className="mt-4 text-xs text-ink-faint">Aún no hay aprobaciones para graficar.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {categories.map((category) => {
                  const max = categories[0]?.total ?? 1
                  const width = max > 0 ? (category.total / max) * 100 : 0
                  return (
                    <div key={category.category}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
                          <CategoryIcon category={category.category} className="size-3.5" />
                          {CATEGORY_CONFIG[category.category].label}
                        </span>
                        <span className="tabular font-bold text-ink">
                          {formatMoney(category.total, currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas-deep">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(width, 1.5)}%`,
                            backgroundColor: CATEGORY_COLORS[category.category],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function DonutChart({
  categories,
  total,
  currency,
}: {
  categories: Array<{ category: ExpenseCategory; total: number; count: number }>
  total: number
  currency: Currency
}) {
  let accumulated = 0
  const segments = categories.map((category) => {
    const start = accumulated
    accumulated += total > 0 ? (category.total / total) * 100 : 0
    return `${CATEGORY_COLORS[category.category]} ${start}% ${accumulated}%`
  })

  return (
    <div className="relative mx-auto size-44 sm:size-48" aria-hidden>
      <div
        className="size-full rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      />
      <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-surface text-center shadow-[inset_0_0_0_1px_rgba(228,223,210,0.9)]">
        <span className="text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-ink-faint">Total</span>
        <span className="tabular mt-1 px-2 font-display text-sm font-bold leading-tight text-ink">
          {formatMoney(total, currency)}
        </span>
        <span className="mt-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-faint">
          {currency}
        </span>
      </div>
    </div>
  )
}
