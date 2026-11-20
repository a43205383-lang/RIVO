import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input, Select } from '@/shared/components/ui/Field'
import { Button } from '@/shared/components/ui/Button'
import { CATEGORY_CONFIG, CURRENCY_LABELS, STATUS_CONFIG } from '@/features/expenses/constants'
import { activeFilterCount } from '@/features/expenses/lib/filters'
import type { ExpenseFilters as Filters } from '@/features/expenses/types'
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, CURRENCIES } from '@/shared/types/domain'

export function ExpenseFilters({
  filters,
  onChange,
  showFilters,
  onToggleFilters,
  resultCount,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  showFilters: boolean
  onToggleFilters: () => void
  resultCount: number
}) {
  const active = activeFilterCount(filters)
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="card mb-4 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Buscar por comercio, RNC o NCF"
            className="pl-10 pr-10"
            aria-label="Buscar gastos por comercio"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => update('search', '')}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:bg-canvas-deep hover:text-ink"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          variant={active > 0 ? 'primary' : 'secondary'}
          onClick={onToggleFilters}
          className="relative shrink-0 px-3.5"
          aria-expanded={showFilters}
          aria-controls="expense-filter-panel"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {active > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[0.625rem] font-bold">
              {active}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div id="expense-filter-panel" className="mt-3 animate-fade-in border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-soft">Desde</span>
              <Input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => update('dateFrom', event.target.value)}
                className="min-h-10 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-soft">Hasta</span>
              <Input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => update('dateTo', event.target.value)}
                className="min-h-10 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-soft">Categoría</span>
              <Select
                value={filters.category}
                onChange={(event) => update('category', event.target.value as Filters['category'])}
                className="min-h-10 py-2 text-sm"
              >
                <option value="all">Todas</option>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_CONFIG[category].label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-soft">Estado</span>
              <Select
                value={filters.status}
                onChange={(event) => update('status', event.target.value as Filters['status'])}
                className="min-h-10 py-2 text-sm"
              >
                <option value="all">Todos</option>
                {EXPENSE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-soft">Moneda</span>
              <Select
                value={filters.currency}
                onChange={(event) => update('currency', event.target.value as Filters['currency'])}
                className="min-h-10 py-2 text-sm"
              >
                <option value="all">Todas</option>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {CURRENCY_LABELS[currency]}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-faint">
              {resultCount} gasto{resultCount === 1 ? '' : 's'} encontrado{resultCount === 1 ? '' : 's'}
            </p>
            {active > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    search: '',
                    category: 'all',
                    status: 'all',
                    dateFrom: '',
                    dateTo: '',
                    currency: 'all',
                  })
                }
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
