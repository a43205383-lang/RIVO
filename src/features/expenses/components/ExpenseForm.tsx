import { Calculator, Sparkles } from 'lucide-react'
import { Field, Input, Select, Textarea } from '@/shared/components/ui/Field'
import { Button } from '@/shared/components/ui/Button'
import { CATEGORY_CONFIG, CURRENCY_LABELS, PAYMENT_METHOD_LABELS } from '@/features/expenses/constants'
import { LineItemsEditor } from '@/features/expenses/components/LineItemsEditor'
import { ArithmeticWarning } from '@/features/expenses/components/ArithmeticWarning'
import { checkArithmetic } from '@/features/expenses/lib/arithmetic'
import { parseAmount, roundMoney } from '@/shared/lib/money'
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/shared/types/domain'
import type { ExpenseFormValues } from '@/features/expenses/types'
import type { ExpenseCategory, PaymentMethod } from '@/shared/types/domain'

export interface ExpenseFormProps {
  values: ExpenseFormValues
  errors: Record<string, string>
  confidence: Record<string, number>
  touched: Record<string, boolean>
  onChange: <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => void
  onItemChange: (key: string, field: 'description' | 'quantity' | 'unitPrice', value: string) => void
  onAddItem: () => void
  onRemoveItem: (key: string) => void
}

export function ExpenseForm({
  values,
  errors,
  confidence,
  touched,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
}: ExpenseFormProps) {
  const arithmetic = checkArithmetic(values)

  const confidenceFor = (key: string) => (touched[key] ? null : (confidence[key] ?? null))
  const lowConfidence = (key: string) => {
    const value = confidenceFor(key)
    return typeof value === 'number' && value < 0.7
  }

  const applyItbis = () => {
    const subtotal = parseAmount(values.subtotal)
    if (subtotal === null) {
      onChange('tax', '')
      return
    }
    const tax = roundMoney(subtotal * 0.18)
    const tip = parseAmount(values.tip) ?? 0
    onChange('tax', tax.toFixed(2))
    onChange('total', roundMoney(subtotal + tax + tip).toFixed(2))
  }

  const applyTotal = () => {
    const subtotal = parseAmount(values.subtotal)
    if (subtotal === null) return
    const tax = parseAmount(values.tax) ?? 0
    const tip = parseAmount(values.tip) ?? 0
    onChange('total', roundMoney(subtotal + tax + tip).toFixed(2))
  }

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <SectionHeading
          title="Datos del recibo"
          description="Comercio y fecha que aparecen en el comprobante."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Comercio"
            htmlFor="merchant"
            error={errors.merchant}
            confidence={confidenceFor('merchant')}
            required
            className="sm:col-span-2"
          >
            <Input
              id="merchant"
              value={values.merchant}
              onChange={(event) => onChange('merchant', event.target.value)}
              placeholder="Ej. Supermercado del Este"
              autoComplete="off"
              maxLength={160}
              invalid={Boolean(errors.merchant)}
              lowConfidence={lowConfidence('merchant')}
            />
          </Field>

          <Field
            label="Fecha"
            htmlFor="expenseDate"
            error={errors.expenseDate}
            confidence={confidenceFor('expenseDate')}
            required
          >
            <Input
              id="expenseDate"
              type="date"
              value={values.expenseDate}
              onChange={(event) => onChange('expenseDate', event.target.value)}
              invalid={Boolean(errors.expenseDate)}
              lowConfidence={lowConfidence('expenseDate')}
            />
          </Field>

          <Field
            label="Moneda"
            htmlFor="currency"
            error={errors.currency}
            confidence={confidenceFor('currency')}
          >
            <Select
              id="currency"
              value={values.currency}
              onChange={(event) => onChange('currency', event.target.value as ExpenseFormValues['currency'])}
              lowConfidence={lowConfidence('currency')}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <SectionHeading
            title="Importes"
            description="El ITBIS local es 18 %. La propina es opcional."
          />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={applyItbis} icon={<Calculator className="size-3.5" />}>
              ITBIS 18 %
            </Button>
            <Button size="sm" variant="ghost" onClick={applyTotal}>
              Calcular total
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Field
            label="Subtotal"
            htmlFor="subtotal"
            error={errors.subtotal}
            confidence={confidenceFor('subtotal')}
          >
            <Input
              id="subtotal"
              inputMode="decimal"
              value={values.subtotal}
              onChange={(event) => onChange('subtotal', event.target.value)}
              placeholder="0.00"
              className="tabular"
              invalid={Boolean(errors.subtotal)}
              lowConfidence={lowConfidence('subtotal')}
            />
          </Field>
          <Field label="ITBIS" htmlFor="tax" error={errors.tax} confidence={confidenceFor('tax')}>
            <Input
              id="tax"
              inputMode="decimal"
              value={values.tax}
              onChange={(event) => onChange('tax', event.target.value)}
              placeholder="0.00"
              className="tabular"
              invalid={Boolean(errors.tax)}
              lowConfidence={lowConfidence('tax')}
            />
          </Field>
          <Field label="Propina" htmlFor="tip" error={errors.tip} confidence={confidenceFor('tip')} optional>
            <Input
              id="tip"
              inputMode="decimal"
              value={values.tip}
              onChange={(event) => onChange('tip', event.target.value)}
              placeholder="0.00"
              className="tabular"
              invalid={Boolean(errors.tip)}
              lowConfidence={lowConfidence('tip')}
            />
          </Field>
          <Field
            label="Total"
            htmlFor="total"
            error={errors.total}
            confidence={confidenceFor('total')}
            required
          >
            <Input
              id="total"
              inputMode="decimal"
              value={values.total}
              onChange={(event) => onChange('total', event.target.value)}
              placeholder="0.00"
              className="tabular font-bold"
              invalid={Boolean(errors.total)}
              lowConfidence={lowConfidence('total')}
            />
          </Field>
        </div>

        <div className="mt-3 space-y-2">
          <ArithmeticWarning arithmetic={arithmetic} currency={values.currency} showSuccess />
          {values.currency === 'USD' && (
            <p className="text-[0.6875rem] text-ink-faint">
              Gasto en USD. El resumen y los totales se calculan por moneda para no sumar manzanas con naranjas.
            </p>
          )}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <SectionHeading title="Clasificación" description="La IA sugiere una categoría; puedes cambiarla." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Categoría"
            htmlFor="category"
            error={errors.category}
            confidence={confidenceFor('category')}
            required
          >
            <Select
              id="category"
              value={values.category}
              onChange={(event) => onChange('category', event.target.value as ExpenseCategory)}
              lowConfidence={lowConfidence('category')}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_CONFIG[category].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Método de pago"
            htmlFor="paymentMethod"
            error={errors.paymentMethod}
            confidence={confidenceFor('paymentMethod')}
            optional
          >
            <Select
              id="paymentMethod"
              value={values.paymentMethod}
              onChange={(event) =>
                onChange('paymentMethod', event.target.value as PaymentMethod | '')
              }
              lowConfidence={lowConfidence('paymentMethod')}
            >
              <option value="">No indicado</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="RNC"
            htmlFor="rnc"
            error={errors.rnc}
            confidence={confidenceFor('rnc')}
            hint="Solo en facturas formales."
            optional
          >
            <Input
              id="rnc"
              value={values.rnc}
              onChange={(event) => onChange('rnc', event.target.value)}
              placeholder="1-01-12345-6"
              maxLength={30}
              autoCapitalize="characters"
              invalid={Boolean(errors.rnc)}
              lowConfidence={lowConfidence('rnc')}
            />
          </Field>

          <Field
            label="NCF"
            htmlFor="ncf"
            error={errors.ncf}
            confidence={confidenceFor('ncf')}
            hint="Número de comprobante fiscal."
            optional
          >
            <Input
              id="ncf"
              value={values.ncf}
              onChange={(event) => onChange('ncf', event.target.value)}
              placeholder="B0100000001"
              maxLength={30}
              autoCapitalize="characters"
              invalid={Boolean(errors.ncf)}
              lowConfidence={lowConfidence('ncf')}
            />
          </Field>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading
            title="Líneas de detalle"
          />
          {values.items.length > 0 && (
            <span className="rounded-full bg-canvas-deep px-2 py-0.5 text-[0.625rem] font-bold text-ink-soft">
              {values.items.length}
            </span>
          )}
        </div>
        <div className="mt-4">
          <LineItemsEditor
            items={values.items}
            errors={errors}
            onChange={onItemChange}
            onAdd={onAddItem}
            onRemove={onRemoveItem}
          />
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <SectionHeading title="Notas" description="Contexto útil para contabilidad." />
        <div className="mt-4">
          <Field label="Notas" htmlFor="notes" error={errors.notes} optional>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              placeholder="Ej. Almuerzo de reunión con proveedor…"
              maxLength={2000}
              invalid={Boolean(errors.notes)}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[0.6875rem] leading-relaxed text-ink-soft">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-sun-500" aria-hidden />
        Los campos resaltados en ámbar son los que la IA marcó con baja confianza. Al editarlos, el aviso
        desaparece. La aritmética no bloquea el guardado: te avisa para que decidas.
      </div>
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-display text-base font-bold tracking-tight text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p>}
    </div>
  )
}
