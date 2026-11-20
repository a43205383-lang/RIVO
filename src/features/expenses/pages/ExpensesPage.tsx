import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, ReceiptText, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useExpenses } from '@/features/expenses/hooks/useExpenses'
import { useSignedUrls } from '@/features/expenses/hooks/useSignedUrls'
import { useToast } from '@/shared/components/ui/Toast'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button, buttonStyles } from '@/shared/components/ui/Button'
import { ExpenseFilters } from '@/features/expenses/components/ExpenseFilters'
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard'
import { ExpenseListSkeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { activeFilterCount, hasActiveFilters } from '@/features/expenses/lib/filters'
import { listAllExpenses } from '@/features/expenses/api/expensesApi'
import { buildExpensesCsv } from '@/features/expenses/lib/csv'
import { downloadText } from '@/shared/lib/download'
import { todayISO } from '@/shared/lib/date'
import { errorMessage } from '@/shared/lib/errors'
import { emptyExpenseFilters, type ExpenseFilters as Filters } from '@/features/expenses/types'

export function ExpensesPage() {
  useDocumentTitle('Gastos')
  const { isAccountant } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [filters, setFilters] = useState<Filters>(emptyExpenseFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)

  const debouncedSearch = useDebouncedValue(filters.search, 350)
  const effectiveFilters = useMemo<Filters>(
    () => ({
      search: debouncedSearch,
      category: filters.category,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      currency: filters.currency,
    }),
    [debouncedSearch, filters.category, filters.status, filters.dateFrom, filters.dateTo, filters.currency],
  )

  const {
    expenses,
    total,
    loading,
    loadingMore,
    error,
    fromCache,
    hasMore,
    refresh,
    loadMore,
  } = useExpenses(effectiveFilters)

  const thumbPaths = useMemo(
    () =>
      expenses
        .map((expense) => {
          const image = expense.images[0]
          return image?.thumb_path ?? image?.storage_path ?? ''
        })
        .filter(Boolean),
    [expenses],
  )
  const { urls } = useSignedUrls(thumbPaths)

  const active = activeFilterCount(filters)

  const handleExport = async () => {
    if (!online) {
      toast.error('Necesitas conexión para exportar todos los gastos.')
      return
    }
    setExporting(true)
    try {
      const all = await listAllExpenses(effectiveFilters)
      if (all.length === 0) {
        toast.info('No hay gastos que coincidan con los filtros.')
        return
      }
      const csv = buildExpensesCsv(all)
      downloadText(csv, `rivo-gastos-${todayISO()}.csv`)
      toast.success(`${all.length} gasto${all.length === 1 ? '' : 's'} exportado${all.length === 1 ? '' : 's'} a CSV.`)
    } catch (caught) {
      toast.error(errorMessage(caught, 'No pudimos exportar los gastos.'))
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => setFilters(emptyExpenseFilters)

  return (
    <div>
      <PageHeader
        eyebrow="Registro"
        title="Gastos"
        description="Ordenados del más reciente al más antiguo. Solo los aprobados cuentan en los totales."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleExport()}
              loading={exporting}
              icon={<Download className="size-4" />}
            >
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Link to="/capture" className={buttonStyles({ variant: 'primary' })}>
              <Plus className="size-4" aria-hidden />
              Escanear
            </Link>
          </>
        }
      />

      <ExpenseFilters
        filters={filters}
        onChange={setFilters}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((current) => !current)}
        resultCount={total}
      />

      {fromCache && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {online
              ? 'Mostrando la última copia guardada porque no pudimos consultar el servidor.'
              : 'Mostrando los gastos guardados en este dispositivo. Al recuperar la conexión se actualizarán.'}
          </span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-faint">
          {total} gasto{total === 1 ? '' : 's'}
          {active > 0 ? ` · ${active} filtro${active === 1 ? '' : 's'} activo${active === 1 ? '' : 's'}` : ''}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={!online}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Actualizar
        </button>
      </div>

      {loading ? (
        <ExpenseListSkeleton count={5} />
      ) : error && expenses.length === 0 ? (
        <ErrorState
          title="No pudimos cargar los gastos"
          description={error}
          onRetry={refresh}
        />
      ) : expenses.length === 0 ? (
        hasActiveFilters(filters) ? (
          <EmptyState
            icon={<SearchX className="size-7" />}
            title="Sin resultados"
            description="No encontramos gastos con esos filtros. Prueba con otro rango de fechas o limpia la búsqueda."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<ReceiptText className="size-7" />}
            title="Aún no hay gastos"
            description="Toma la primera foto y deja que Rivo extraiga comercio, fecha, ITBIS y total."
            action={
              <Link to="/capture" className={buttonStyles({ variant: 'primary' })}>
                <Plus className="size-4" aria-hidden />
                Escanear recibo
              </Link>
            }
          />
        )
      ) : (
        <>
          {error && (
            <div className="mb-3 rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-2.5 text-xs text-berry-700" role="alert">
              {error}
            </div>
          )}
          <div className="space-y-2.5">
            {expenses.map((expense) => {
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

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" onClick={() => void loadMore()} loading={loadingMore}>
                Cargar más gastos
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
