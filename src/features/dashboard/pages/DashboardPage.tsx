import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  ChartPie,
  CheckCircle2,
  Clock3,
  PieChart,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useMonthlySummary } from '@/features/expenses/hooks/useMonthlySummary'
import { useExpenses } from '@/features/expenses/hooks/useExpenses'
import { useSignedUrls } from '@/features/expenses/hooks/useSignedUrls'
import { countPendingApprovals } from '@/features/expenses/api/expensesApi'
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard'
import { CategoryIcon } from '@/features/expenses/components/CategoryBadge'
import { CATEGORY_CONFIG } from '@/features/expenses/constants'
import { InstallCard } from '@/features/pwa/components/InstallCard'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { buttonStyles } from '@/shared/components/ui/Button'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { ExpenseListSkeleton, Skeleton } from '@/shared/components/ui/Skeleton'
import { formatMoney, formatNumber } from '@/shared/lib/money'
import { currentMonth, monthLabel } from '@/shared/lib/date'
import { cn } from '@/shared/lib/cn'
import { emptyExpenseFilters } from '@/features/expenses/types'

const RECENT_LIMIT = 5
const RECENT_FILTERS = { ...emptyExpenseFilters }

export function DashboardPage() {
  useDocumentTitle('Inicio')
  const { profile, isAccountant } = useAuth()
  const online = useOnlineStatus()
  const month = currentMonth()

  const summary = useMonthlySummary({ month, currency: 'DOP', scopeAll: isAccountant })
  const recent = useExpenses(RECENT_FILTERS, 8)
  const [pending, setPending] = useState<number | null>(null)

  const refreshPending = useCallback(async () => {
    if (!isAccountant || !online) return
    try {
      setPending(await countPendingApprovals())
    } catch {
      setPending(null)
    }
  }, [isAccountant, online])

  useEffect(() => {
    void refreshPending()
    const handle = () => void refreshPending()
    window.addEventListener('rivo:expenses-changed', handle)
    window.addEventListener('focus', handle)
    return () => {
      window.removeEventListener('rivo:expenses-changed', handle)
      window.removeEventListener('focus', handle)
    }
  }, [refreshPending])

  const recentExpenses = recent.expenses.slice(0, RECENT_LIMIT)
  const thumbPaths = useMemo(
    () =>
      recentExpenses
        .map((expense) => {
          const image = expense.images[0]
          return image?.thumb_path ?? image?.storage_path ?? ''
        })
        .filter(Boolean),
    [recentExpenses],
  )
  const { urls } = useSignedUrls(thumbPaths)

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || profile?.email?.split('@')[0] || 'bienvenido'
  const greeting = greetingForHour()
  const data = summary.summary
  const categories = [...(data?.byCategory ?? [])]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  return (
    <div>
      <PageHeader
        eyebrow={`${greeting}, ${firstName}`}
        title={isAccountant ? 'El pulso de los gastos' : 'Tus gastos, bajo control'}
        description={
          isAccountant
            ? 'Revisa lo que reporta el equipo, aprueba pendientes y entiende en qué se va el dinero.'
            : 'Captura un recibo en segundos. La IA lo ordena y contabilidad lo aprueba.'
        }
        actions={
          <Link to="/capture" className={buttonStyles({ variant: 'primary' })}>
            <Camera className="size-4" aria-hidden />
            Escanear recibo
          </Link>
        }
      />

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Sin conexión: mostramos lo último guardado en este dispositivo.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-5 text-white shadow-float sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-700/40 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-sun-500/15 blur-2xl" aria-hidden />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-brand-200">
                  {monthLabel(month)} · {isAccountant ? 'Equipo' : 'Tus gastos'}
                </p>
                <p className="mt-2 font-display text-[2.5rem] font-bold leading-none tracking-[-0.04em]">
                  {summary.loading && !data ? (
                    <span className="inline-block h-10 w-44 animate-pulse rounded-lg bg-white/15" />
                  ) : (
                    formatMoney(data?.total ?? 0, 'DOP')
                  )}
                </p>
                <p className="mt-2 text-xs text-brand-200">Solo gastos aprobados por contabilidad.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-100">
                <ShieldCheck className="size-3.5" aria-hidden />
                Verificado
              </span>
            </div>

            {summary.error && (
              <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-sun-100">{summary.error}</p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <MiniStat
                icon={CheckCircle2}
                label="Aprobados"
                value={data ? `${formatNumber(data.count)}` : '—'}
              />
              <MiniStat
                icon={Clock3}
                label="En espera"
                value={data ? formatMoney(data.pendingTotal, 'DOP') : '—'}
                hint={data ? `${formatNumber(data.pendingCount)} gasto${data.pendingCount === 1 ? '' : 's'}` : undefined}
              />
            </div>

            {categories.length > 0 && (
              <div className="mt-5 space-y-2.5">
                {categories.map((category) => {
                  const percent = data && data.total > 0 ? Math.min(100, (category.total / data.total) * 100) : 0
                  return (
                    <div key={category.category}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[0.6875rem]">
                        <span className="flex items-center gap-1.5 font-semibold text-brand-100">
                          <CategoryIcon category={category.category} className="size-3 text-sun-300" />
                          {CATEGORY_CONFIG[category.category].label}
                        </span>
                        <span className="tabular font-bold text-white">
                          {formatMoney(category.total, 'DOP')}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sun-400 to-sun-300"
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/summary"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/15"
              >
                <PieChart className="size-3.5" aria-hidden />
                Ver resumen
              </Link>
              <Link
                to="/expenses"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/15"
              >
                <ReceiptText className="size-3.5" aria-hidden />
                Todos los gastos
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 content-start">
          <QuickAction
            to="/capture"
            icon={Camera}
            title="Escanear"
            description="Foto o galería"
            tone="brand"
          />
          <QuickAction
            to="/expenses"
            icon={ReceiptText}
            title="Gastos"
            description="Filtrar y exportar"
          />
          <QuickAction
            to="/summary"
            icon={ChartPie}
            title="Resumen"
            description="Por categoría"
          />
          <QuickAction
            to="/ask"
            icon={Sparkles}
            title="Consultas IA"
            description="Pregunta en español"
            tone="sun"
          />
          {isAccountant && (
            <QuickAction
              to="/approvals"
              icon={ShieldCheck}
              title="Aprobaciones"
              description={
                pending === null ? 'Pendientes' : pending === 0 ? 'Todo al día' : `${pending} pendiente${pending === 1 ? '' : 's'}`
              }
              tone={pending && pending > 0 ? 'berry' : 'brand'}
              className="col-span-2"
            />
          )}
          <div className="col-span-2">
            <InstallCard compact />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="min-w-0">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">Recientes</h2>
            <Link
              to="/expenses"
              className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              Ver todos
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {recent.loading ? (
            <ExpenseListSkeleton count={3} />
          ) : recent.error && recent.expenses.length === 0 ? (
            <ErrorState description={recent.error} onRetry={recent.refresh} />
          ) : recentExpenses.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="size-7" />}
              title="Tu primer recibo te espera"
              description="Toma una foto del recibo y deja que Rivo extraiga comercio, fecha, ITBIS y total."
              action={
                <Link to="/capture" className={buttonStyles({ variant: 'primary' })}>
                  <Plus className="size-4" aria-hidden />
                  Escanear recibo
                </Link>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {recentExpenses.map((expense) => {
                const image = expense.images[0]
                const path = image?.thumb_path ?? image?.storage_path
                return (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    thumbUrl={path ? urls[path] : null}
                    showOwner={isAccountant}
                  />
                )
              })}
            </div>
          )}
        </section>

        <aside className="space-y-3">
          {isAccountant ? (
            <section className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Aprobaciones</h2>
                {pending !== null && pending > 0 && (
                  <span className="flex min-w-6 items-center justify-center rounded-full bg-berry-500 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
                    {pending > 99 ? '99+' : pending}
                  </span>
                )}
              </div>
              {pending === null ? (
                <Skeleton className="mt-3 h-12" />
              ) : pending === 0 ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>Todo al día. No hay gastos esperando tu revisión.</p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    {pending} gasto{pending === 1 ? '' : 's'} confirmado{pending === 1 ? '' : 's'} espera
                    {pending === 1 ? '' : 'n'} tu decisión.
                  </p>
                  <Link
                    to="/approvals"
                    className={buttonStyles({ variant: 'primary', className: 'mt-3 w-full' })}
                  >
                    Revisar ahora
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </>
              )}
            </section>
          ) : (
            <section className="card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-brand-600" aria-hidden />
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Cómo funciona</h2>
              </div>
              <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-soft">
                <Step number={1} title="Captura" body="Foto con la cámara trasera o desde tu galería." />
                <Step number={2} title="La IA completa" body="Comercio, fecha, ITBIS, total y categoría." />
                <Step number={3} title="Tú confirmas" body="Revisas los campos en ámbar y envías." />
                <Step number={4} title="Contabilidad aprueba" body="Solo entonces suma en los totales." />
              </ol>
              <Link
                to="/capture"
                className={buttonStyles({ variant: 'secondary', className: 'mt-3 w-full' })}
              >
                <Camera className="size-4" aria-hidden />
                Empezar ahora
              </Link>
            </section>
          )}

          <section className="rounded-2xl border border-sun-200 bg-sun-50 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sun-600">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-sun-900">Pregunta en español</p>
                <p className="mt-0.5 text-xs leading-relaxed text-sun-800">
                  «¿Cuánto gasté en combustible este mes?» La IA consulta tus datos aprobados y te
                  responde sin inventar cifras.
                </p>
                <Link
                  to="/ask"
                  className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-sun-800 underline-offset-4 hover:underline"
                >
                  Hacer una consulta
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-[0.6875rem] text-ink-faint">
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            <span>Los montos se separan por moneda para no mezclar DOP con USD.</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

function greetingForHour(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CheckCircle2
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-brand-200">
        <Icon className="size-3" aria-hidden />
        {label}
      </p>
      <p className="tabular mt-1 text-sm font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[0.625rem] text-brand-200">{hint}</p>}
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  className,
}: {
  to: string
  icon: typeof Camera
  title: string
  description: string
  tone?: 'neutral' | 'brand' | 'sun' | 'berry'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface text-brand-700',
    brand: 'bg-brand-50 text-brand-700',
    sun: 'bg-sun-50 text-sun-700',
    berry: 'bg-berry-50 text-berry-600',
  }
  return (
    <Link
      to={to}
      className={cn(
        'card group flex min-h-[5.5rem] flex-col justify-between p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_36px_-24px_rgba(15,61,51,0.35)]',
        className,
      )}
    >
      <span className={cn('flex size-9 items-center justify-center rounded-xl', tones[tone])}>
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <span>
          <span className="block text-sm font-bold text-ink">{title}</span>
          <span className="mt-0.5 block text-[0.6875rem] leading-tight text-ink-faint">{description}</span>
        </span>
        <ArrowRight
          className="mb-0.5 size-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  )
}

function Step({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.625rem] font-bold text-brand-800">
        {number}
      </span>
      <span>
        <strong className="font-bold text-ink">{title}.</strong> {body}
      </span>
    </li>
  )
}
