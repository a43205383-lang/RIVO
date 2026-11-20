import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Field'
import { parseAmount } from '@/shared/lib/money'
import type { ExpenseFormItem } from '@/features/expenses/types'

export function LineItemsEditor({
  items,
  errors,
  onChange,
  onAdd,
  onRemove,
}: {
  items: ExpenseFormItem[]
  errors: Record<string, string>
  onChange: (key: string, field: 'description' | 'quantity' | 'unitPrice', value: string) => void
  onAdd: () => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong bg-canvas/40 px-3.5 py-4 text-center text-xs text-ink-faint">
          Sin líneas de detalle. Puedes agregarlas si el recibo las muestra.
        </p>
      )}

      {items.map((item, index) => {
        const quantity = parseAmount(item.quantity)
        const unitPrice = parseAmount(item.unitPrice)
        const lineTotal = quantity !== null && unitPrice !== null ? quantity * unitPrice : null
        return (
          <div key={item.key} className="rounded-xl border border-line bg-canvas/35 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`item-desc-${item.key}`}>
                  Descripción del ítem {index + 1}
                </label>
                <Input
                  id={`item-desc-${item.key}`}
                  value={item.description}
                  onChange={(event) => onChange(item.key, 'description', event.target.value)}
                  placeholder="Descripción del ítem"
                  className="min-h-10 py-2 text-sm"
                  invalid={Boolean(errors[`items.${index}.description`])}
                />
                {errors[`items.${index}.description`] && (
                  <p className="mt-1 text-[0.6875rem] text-berry-600">{errors[`items.${index}.description`]}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-berry-50 hover:text-berry-600"
                aria-label={`Eliminar ítem ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_1.4fr_auto] items-start gap-2">
              <div>
                <label className="mb-0.5 block text-[0.625rem] font-semibold text-ink-faint" htmlFor={`item-qty-${item.key}`}>
                  Cantidad
                </label>
                <Input
                  id={`item-qty-${item.key}`}
                  value={item.quantity}
                  onChange={(event) => onChange(item.key, 'quantity', event.target.value)}
                  inputMode="decimal"
                  className="min-h-9 py-1.5 text-sm"
                  invalid={Boolean(errors[`items.${index}.quantity`])}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[0.625rem] font-semibold text-ink-faint" htmlFor={`item-price-${item.key}`}>
                  Precio unitario
                </label>
                <Input
                  id={`item-price-${item.key}`}
                  value={item.unitPrice}
                  onChange={(event) => onChange(item.key, 'unitPrice', event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-h-9 py-1.5 text-sm"
                  invalid={Boolean(errors[`items.${index}.unitPrice`])}
                />
              </div>
              <div className="pt-4 text-right">
                <span className="tabular text-xs font-bold text-ink-soft">
                  {lineTotal === null ? '—' : lineTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      <Button variant="secondary" size="sm" onClick={onAdd} icon={<Plus className="size-4" />}>
        Agregar línea
      </Button>
    </div>
  )
}
