import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  FileWarning,
  Save,
  Sparkles,
  Wand2,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useExpense } from '@/features/expenses/hooks/useExpense'
import { useSignedUrls } from '@/features/expenses/hooks/useSignedUrls'
import { useDuplicateCheck } from '@/features/expenses/hooks/useDuplicateCheck'
import { getExpense, saveExpense } from '@/features/expenses/api/expensesApi'
import { reanalyzeExpense } from '@/features/capture/api/processReceipt'
import {
  emptyExpenseForm,
  formItemsToRows,
  formToExpenseUpdate,
  fullFormFromExpense,
  newFormItem,
  parseStoredConfidence,
} from '@/features/expenses/lib/form'
import { checkArithmetic } from '@/features/expenses/lib/arithmetic'
import { expenseFormErrors, firstFormError } from '@/features/expenses/lib/validation'
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm'
import { ReceiptGallery } from '@/features/expenses/components/ReceiptGallery'
import { DuplicateWarning } from '@/features/expenses/components/DuplicateWarning'
import { StatusBadge } from '@/features/expenses/components/StatusBadge'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button, buttonStyles } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { useToast } from '@/shared/components/ui/Toast'
import { formatDateTime } from '@/shared/lib/date'
import { parseAmount } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/errors'
import { cn } from '@/shared/lib/cn'
import type { ExpenseFormValues } from '@/features/expenses/types'

type Mode = 'review' | 'edit'

const REVIEW_REASONS: Record<string, { title: string; body: string }> = {
  not_receipt: {
    title: 'La imagen no parece un recibo',
    body: 'La IA dejó los campos vacíos para no inventar datos. Si es un recibo válido, completa los datos manualmente o vuelve a analizarlo.',
  },
  illegible: {
    title: 'El recibo está ilegible',
    body: 'No pudimos leer los datos con confianza. Puedes intentar con una foto más clara o completar el formulario a mano.',
  },
  extraction_failed: {
    title: 'La extracción con IA falló',
    body: 'El recibo quedó guardado, pero no pudimos analizarlo. Completa los datos a mano o reintenta el análisis.',
  },
  pdf_manual: {
    title: 'PDF adjunto',
    body: 'La IA no analiza archivos PDF. Completa los datos del recibo manualmente para poder confirmarlo.',
  },
}

export function ReviewExpensePage({ mode }: { mode: Mode }) {
  const { expenseId } = useParams<{ expenseId: string }>()
  useDocumentTitle(mode === 'review' ? 'Revisar gasto' : 'Editar gasto')
  const { user } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const navigate = useNavigate()
  const { expense, loading, error, fromCache, refresh, setExpense } = useExpense(expenseId)

  const [values, setValues] = useState<ExpenseFormValues>(() => emptyExpenseForm())
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formReady, setFormReady] = useState(false)
  const [saving, setSaving] = useState<false | 'draft' | 'confirmed'>(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const loadedKeyRef = useRef<string | null>(null)

  const imagePaths = useMemo(
    () =>
      expense
        ? expense.images.flatMap((image) => [image.storage_path, image.thumb_path].filter(Boolean) as string[])
        : [],
    [expense],
  )
  const { urls } = useSignedUrls(imagePaths)
  const imageHash = expense?.images.find((image) => image.image_hash)?.image_hash ?? null

  const { duplicates, checking } = useDuplicateCheck({
    merchant: values.merchant,
    expenseDate: values.expenseDate,
    total: parseAmount(values.total),
    imageHash,
    excludeId: expense?.id,
    enabled: formReady,
  })

  const arithmetic = checkArithmetic(values)
  const isOwner = Boolean(expense && user && expense.user_id === user.id)
  const isApproved = expense?.status === 'approved'
  const canEdit = Boolean(expense && isOwner && !isApproved)

  useEffect(() => {
    if (!expense) return
    const key = `${expense.id}:${expense.updated_at}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key
    setValues(fullFormFromExpense(expense))
    setConfidence(parseStoredConfidence(expense.ai_confidence))
    setTouched({})
    setErrors({})
    setActionError(null)
    setFormReady(true)
  }, [expense])

  const reviewReason = expense?.review_reason ? REVIEW_REASONS[expense.review_reason] : null

  const updateField = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setTouched((current) => ({ ...current, [key]: true }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }

  const updateItem = (key: string, field: 'description' | 'quantity' | 'unitPrice', value: string) => {
    setValues((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }))
  }

  const addItem = () => {
    setValues((current) => ({ ...current, items: [...current.items, newFormItem()] }))
  }

  const removeItem = (key: string) => {
    setValues((current) => ({ ...current, items: current.items.filter((item) => item.key !== key) }))
    setErrors((current) => {
      const next: Record<string, string> = {}
      for (const [errorKey, message] of Object.entries(current)) {
        if (!errorKey.startsWith('items.')) next[errorKey] = message
      }
      return next
    })
  }

  const handleReanalyze = async () => {
    if (!expense) return
    setReanalyzing(true)
    setActionError(null)
    try {
      await reanalyzeExpense(expense.id, expense.user_id)
      const fresh = await getExpense(expense.id)
      setExpense(fresh)
      // Fuerza la reinicialización del formulario con lo que devolvió la IA.
      loadedKeyRef.current = null
      setReanalyzeOpen(false)
      toast.success('La IA volvió a analizar el recibo. Revisa los campos resaltados.')
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos volver a analizar el recibo.'))
    } finally {
      setReanalyzing(false)
    }
  }

  const handleSave = async (status: 'draft' | 'confirmed') => {
    if (!expense || !user) return
    const nextErrors = expenseFormErrors(values, status === 'confirmed' ? 'confirm' : 'draft')
    setErrors(nextErrors)
    const firstError = firstFormError(nextErrors)
    if (firstError) {
      setActionError(firstError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!online) {
      setActionError('Necesitas conexión para guardar los cambios.')
      return
    }

    setSaving(status)
    setActionError(null)
    try {
      const patch = formToExpenseUpdate(values, {
        status,
        isResubmission: expense.status === 'rejected' || expense.status === 'confirmed',
      })
      if (status === 'confirmed') {
        patch.review_reason = null
        if (arithmetic.applicable && !arithmetic.consistent) {
          patch.ai_notes = 'La aritmética del recibo no cuadra; fue confirmado manualmente.'
        }
      }
      const saved = await saveExpense({
        expenseId: expense.id,
        patch,
        items: formItemsToRows(values),
        userId: user.id,
      })
      setExpense(saved)
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
      toast.success(
        status === 'confirmed'
          ? 'Gasto confirmado y enviado a contabilidad.'
          : 'Borrador guardado. Puedes completarlo cuando quieras.',
      )
      navigate(`/expenses/${expense.id}`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos guardar el gasto.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ReviewSkeleton />

  if (error || !expense) {
    return (
      <div>
        <PageHeader
          title={mode === 'review' ? 'Revisar gasto' : 'Editar gasto'}
          backTo={expenseId ? `/expenses/${expenseId}` : '/expenses'}
          backLabel="Volver al detalle"
        />
        <ErrorState
          title="No pudimos abrir el recibo"
          description={error ?? 'El gasto no existe o no tienes permiso para editarlo.'}
          onRetry={refresh}
          action={
            <Link to="/expenses" className={buttonStyles({ variant: 'secondary' })}>
              Ir a gastos
            </Link>
          }
        />
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div>
        <PageHeader
          title={mode === 'review' ? 'Revisar gasto' : 'Editar gasto'}
          backTo={`/expenses/${expense.id}`}
          backLabel="Volver al detalle"
        />
        <div className="card p-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-sun-50 text-sun-600">
            <FileWarning className="size-6" aria-hidden />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">
            {isApproved ? 'Este gasto ya está aprobado' : 'Solo el dueño puede editar este gasto'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            {isApproved
              ? 'Los gastos aprobados quedan bloqueados para mantener la trazabilidad contable. Si necesitas un cambio, crea un gasto nuevo o contacta a contabilidad.'
              : 'Puedes consultar el detalle y, si eres contador, aprobarlo o rechazarlo. La edición corresponde al empleado que registró el recibo.'}
          </p>
          <Link
            to={`/expenses/${expense.id}`}
            className={buttonStyles({ variant: 'secondary', className: 'mt-5' })}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver al detalle
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={mode === 'review' ? 'Paso 2 de 2' : 'Edición'}
        title={mode === 'review' ? 'Revisa y confirma el gasto' : 'Editar gasto'}
        description={
          mode === 'review'
            ? 'La IA completó el formulario. Verifica los campos en ámbar y corrige lo que haga falta antes de enviarlo a contabilidad.'
            : 'Actualiza los datos del recibo. Al confirmar, volverá a la cola de aprobación.'
        }
        backTo={`/expenses/${expense.id}`}
        backLabel="Volver al detalle"
        actions={
          <Button
            variant="secondary"
            onClick={() => void handleSave('draft')}
            loading={saving === 'draft'}
            disabled={saving !== false || !online}
            icon={<Save className="size-4" />}
          >
            Guardar borrador
          </Button>
        }
      />

      {fromCache && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Estás viendo una copia guardada. Necesitas conexión para guardar cambios.</span>
        </div>
      )}

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Sin conexión no podemos guardar. Tus cambios siguen en pantalla; vuelve a intentarlo al recuperar la red.</span>
        </div>
      )}

      {reviewReason && (
        <div className="mb-4 rounded-2xl border border-sun-200 bg-sun-50 p-4">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-sun-600" aria-hidden />
            <div>
              <p className="text-sm font-bold text-sun-800">{reviewReason.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-sun-700">{reviewReason.body}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-3 xl:sticky xl:top-6">
          <section className="card p-3 sm:p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Recibo original
              </p>
              <StatusBadge status={expense.status} />
            </div>
            <ReceiptGallery images={expense.images} urls={urls} />
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
              Toca la imagen para ampliarla y comparar los datos. Los archivos son privados.
            </p>
          </section>

          <section className="card p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-sun-600">
                <Wand2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">Volver a analizar con IA</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  Reemplaza los datos actuales con una nueva lectura del recibo. Útil si la foto estaba
                  borrosa o el resultado no convenció.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2.5"
                  onClick={() => setReanalyzeOpen(true)}
                  disabled={!online || expense.images.length === 0}
                  icon={<Sparkles className="size-3.5" />}
                >
                  Reanalizar
                </Button>
              </div>
            </div>
          </section>

          {expense.ai_notes && (
            <div className="rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-3 text-xs leading-relaxed text-sun-800">
              <p className="font-bold">Nota de la IA</p>
              <p className="mt-0.5">{expense.ai_notes}</p>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <DuplicateWarning duplicates={duplicates} checking={checking} />

          {actionError && (
            <div
              className="rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-3 text-sm text-berry-700"
              role="alert"
            >
              {actionError}
            </div>
          )}

          <ExpenseForm
            values={values}
            errors={errors}
            confidence={confidence}
            touched={touched}
            onChange={updateField}
            onItemChange={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
          />

          <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[0.6875rem] leading-relaxed text-ink-soft">
            Al confirmar, el gasto pasa a <strong className="text-ink">Confirmado</strong> y espera la
            aprobación de contabilidad. Solo los gastos aprobados cuentan en los totales.
          </div>

          <div
            className={cn(
              'sticky bottom-[5.5rem] z-20 rounded-2xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur lg:bottom-4',
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                size="lg"
                className="sm:flex-1"
                onClick={() => void handleSave('draft')}
                loading={saving === 'draft'}
                disabled={saving !== false || !online}
                icon={<Save className="size-4" />}
              >
                Guardar borrador
              </Button>
              <Button
                size="lg"
                className="sm:flex-[1.4]"
                onClick={() => void handleSave('confirmed')}
                loading={saving === 'confirmed'}
                disabled={saving !== false || !online}
                icon={<CheckCircle2 className="size-4" />}
              >
                Confirmar y enviar
              </Button>
            </div>
            <p className="mt-2 text-center text-[0.625rem] text-ink-faint">
              {mode === 'review'
                ? 'Revisa la aritmética y los duplicados antes de confirmar.'
                : `Última actualización: ${formatDateTime(expense.updated_at)}`}
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={reanalyzeOpen}
        onClose={() => {
          if (!reanalyzing) setReanalyzeOpen(false)
        }}
        onConfirm={() => void handleReanalyze()}
        title="¿Volver a analizar con IA?"
        description="La nueva lectura reemplazará los datos actuales del formulario. Si ya hiciste cambios manuales, se perderán."
        confirmLabel="Sí, reanalizar"
        tone="primary"
        loading={reanalyzing}
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-3 text-xs leading-relaxed text-sun-800">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            También consume una llamada de IA. La función tiene límites de uso para controlar costos.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <div>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="aspect-[4/5] rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Cargando recibo para revisión
      </span>
    </div>
  )
}
