import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  WifiOff,
  X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useSignedUrls } from '@/features/expenses/hooks/useSignedUrls'
import {
  approveExpense,
  listPendingApprovals,
  profileName,
  rejectExpense,
} from '@/features/expenses/api/expensesApi'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/errors'
import { CATEGORY_CONFIG } from '@/features/expenses/constants'
import { ReceiptThumb } from '@/features/expenses/components/ExpenseCard'
import { CategoryBadge } from '@/features/expenses/components/CategoryBadge'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { Input, Textarea } from '@/shared/components/ui/Field'
import { Modal } from '@/shared/components/ui/Modal'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { useToast } from '@/shared/components/ui/Toast'
import type { ExpenseWithRelations } from '@/features/expenses/types'

type PendingAction = 'approve' | 'reject'

interface Selection {
  expense: ExpenseWithRelations
  action: PendingAction
}

export function ApprovalsPage() {
  useDocumentTitle('Aprobaciones')
  const { isAccountant } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [items, setItems] = useState<ExpenseWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false)
      setError('Necesitas conexión para revisar las aprobaciones pendientes.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listPendingApprovals()
      setItems(result)
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos cargar las aprobaciones pendientes.'))
    } finally {
      setLoading(false)
    }
  }, [online])

  useEffect(() => {
    if (!isAccountant) return
    void load()
  }, [load, isAccountant, refreshKey])

  const thumbPaths = useMemo(
    () =>
      items
        .map((expense) => {
          const image = expense.images[0]
          return image?.thumb_path ?? image?.storage_path ?? ''
        })
        .filter(Boolean),
    [items],
  )
  const { urls } = useSignedUrls(thumbPaths)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((expense) => {
      const haystack = [
        expense.merchant ?? '',
        expense.owner?.full_name ?? '',
        expense.owner?.email ?? '',
        expense.rnc ?? '',
        expense.ncf ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [items, search])

  const totals = useMemo(() => {
    const result = new Map<'DOP' | 'USD', number>()
    for (const expense of items) {
      if (expense.total === null) continue
      result.set(expense.currency, (result.get(expense.currency) ?? 0) + expense.total)
    }
    return result
  }, [items])

  const openAction = (expense: ExpenseWithRelations, action: PendingAction) => {
    setSelection({ expense, action })
    setComment('')
    setActionError(null)
  }

  const closeAction = () => {
    if (acting) return
    setSelection(null)
    setComment('')
    setActionError(null)
  }

  const handleConfirm = async () => {
    if (!selection) return
    const { expense, action } = selection
    if (action === 'reject' && !comment.trim()) {
      setActionError('Escribe el motivo del rechazo. El empleado lo verá para corregir.')
      return
    }
    setActing(true)
    setActionError(null)
    try {
      if (action === 'approve') await approveExpense(expense.id, comment)
      else await rejectExpense(expense.id, comment)
      setItems((current) => current.filter((item) => item.id !== expense.id))
      setSelection(null)
      setComment('')
      toast.success(
        action === 'approve'
          ? 'Gasto aprobado. Ya cuenta en los totales.'
          : 'Gasto rechazado. El empleado podrá corregirlo.',
      )
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos actualizar el gasto.'))
    } finally {
      setActing(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contabilidad"
        title="Aprobaciones"
        description="Gastos confirmados por el equipo que esperan tu revisión. Ordenados del más antiguo al más reciente."
        actions={
          <Button
            variant="secondary"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={!online}
            icon={<RefreshCw className="size-4" />}
          >
            Actualizar
          </Button>
        }
      />

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Sin conexión no podemos cargar la cola de aprobaciones ni ejecutar acciones. Los gastos ya
            visibles quedan en modo lectura.
          </span>
        </div>
      )}

      <div className="mb-4 grid gap-2.5 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <ClipboardCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-faint">Pendientes</p>
            <p className="tabular font-display text-xl font-bold text-ink">{items.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-faint">Monto DOP</p>
            <p className="tabular truncate font-display text-lg font-bold text-ink">
              {formatMoney(totals.get('DOP') ?? 0, 'DOP')}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas-deep text-ink-soft">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-faint">Monto USD</p>
            <p className="tabular truncate font-display text-lg font-bold text-ink">
              {formatMoney(totals.get('USD') ?? 0, 'USD')}
            </p>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="card mb-4 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por comercio, empleado, RNC o NCF"
              className="pl-10 pr-10"
              aria-label="Buscar aprobaciones pendientes"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:bg-canvas-deep hover:text-ink"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 px-1 text-xs text-ink-faint">
              {filtered.length} resultado{filtered.length === 1 ? '' : 's'} de {items.length}.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <ApprovalsSkeleton />
      ) : error && items.length === 0 ? (
        <ErrorState
          title="No pudimos cargar las aprobaciones"
          description={error}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-7" />}
          title="Todo al día"
          description="No hay gastos confirmados esperando aprobación. Cuando el equipo envíe un recibo, aparecerá aquí."
          action={
            <Link
              to="/expenses"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Ver todos los gastos
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" />}
          title="Sin resultados"
          description="Ningún gasto pendiente coincide con esa búsqueda."
          action={
            <Button variant="secondary" onClick={() => setSearch('')}>
              Limpiar búsqueda
            </Button>
          }
        />
      ) : (
        <>
          {error && (
            <div className="mb-3 rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-2.5 text-xs text-berry-700" role="alert">
              {error}
            </div>
          )}
          <div className="space-y-2.5">
            {filtered.map((expense) => {
              const image = expense.images[0]
              const path = image?.thumb_path ?? image?.storage_path
              return (
                <article key={expense.id} className="card p-3.5 sm:p-4">
                  <div className="flex gap-3">
                    <Link
                      to={`/expenses/${expense.id}`}
                      className="shrink-0 rounded-xl focus-visible:outline-none"
                      aria-label={`Ver detalle de ${expense.merchant || 'gasto'}`}
                    >
                      <ReceiptThumb
                        url={path ? urls[path] : null}
                        isPdf={image?.mime_type === 'application/pdf'}
                        alt={expense.merchant ? `Recibo de ${expense.merchant}` : 'Recibo'}
                        className="size-16 sm:size-20"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/expenses/${expense.id}`}
                            className="block truncate text-[0.9375rem] font-bold text-ink hover:text-brand-700"
                          >
                            {expense.merchant?.trim() || 'Gasto sin comercio'}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-ink-faint">
                            {profileName(expense.owner)} · {formatDate(expense.expense_date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-[0.9375rem] font-bold text-ink">
                            {formatMoney(expense.total, expense.currency)}
                          </p>
                          <p className="text-[0.625rem] font-semibold text-ink-faint">{expense.currency}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <CategoryBadge category={expense.category} />
                        <span className="text-[0.625rem] font-semibold text-ink-faint">
                          {CATEGORY_CONFIG[expense.category].description}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => openAction(expense, 'approve')}
                          disabled={!online}
                          icon={<CheckCircle2 className="size-3.5" />}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openAction(expense, 'reject')}
                          disabled={!online}
                          icon={<ShieldX className="size-3.5 text-berry-600" />}
                        >
                          Rechazar
                        </Button>
                        <Link
                          to={`/expenses/${expense.id}`}
                          className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-ink-soft hover:text-ink"
                        >
                          Ver recibo
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <Modal
        open={Boolean(selection)}
        onClose={closeAction}
        title={selection?.action === 'approve' ? 'Aprobar gasto' : 'Rechazar gasto'}
        description={
          selection?.action === 'approve'
            ? 'El gasto contará en los totales del equipo inmediatamente.'
            : 'El empleado verá tu comentario y podrá corregir el gasto.'
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeAction} disabled={acting}>
              Cancelar
            </Button>
            <Button
              variant={selection?.action === 'approve' ? 'primary' : 'danger'}
              onClick={() => void handleConfirm()}
              loading={acting}
              disabled={selection?.action === 'reject' && !comment.trim()}
              icon={
                selection?.action === 'approve' ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldX className="size-4" />
                )
              }
            >
              {selection?.action === 'approve' ? 'Aprobar gasto' : 'Rechazar gasto'}
            </Button>
          </div>
        }
      >
        {selection && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-canvas/60 p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-700">
              <ClipboardCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {selection.expense.merchant || 'Gasto sin comercio'}
              </p>
              <p className="text-xs text-ink-soft">
                {profileName(selection.expense.owner)} · {formatDate(selection.expense.expense_date)} ·{' '}
                {formatMoney(selection.expense.total, selection.expense.currency)}
              </p>
            </div>
          </div>
        )}

        <label htmlFor="approval-comment" className="text-[0.8125rem] font-semibold text-ink-soft">
          Comentario{' '}
          {selection?.action === 'approve' ? (
            <span className="font-normal text-ink-faint">(opcional)</span>
          ) : (
            <span className="text-berry-500">*</span>
          )}
        </label>
        <Textarea
          id="approval-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={
            selection?.action === 'approve'
              ? 'Ej. Verificado contra la factura del proveedor.'
              : 'Ej. El total no coincide con la imagen. Corrige el ITBIS y reenvía.'
          }
          className="mt-1.5"
          maxLength={1000}
          invalid={Boolean(actionError)}
          required={selection?.action === 'reject'}
        />
        {actionError && <p className="mt-2 text-xs font-medium text-berry-600">{actionError}</p>}
      </Modal>
    </div>
  )
}

function ApprovalsSkeleton() {
  return (
    <div className="space-y-2.5" role="status" aria-label="Cargando aprobaciones">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="card flex gap-3 p-4">
          <Skeleton className="size-16 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
