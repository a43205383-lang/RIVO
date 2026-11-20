import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  MessageSquare,
  Pencil,
  ReceiptText,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trash2,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useExpense } from '@/features/expenses/hooks/useExpense'
import { useSignedUrls } from '@/features/expenses/hooks/useSignedUrls'
import {
  approveExpense,
  deleteExpense,
  expenseSubtitle,
  profileName,
  rejectExpense,
} from '@/features/expenses/api/expensesApi'
import { checkArithmetic } from '@/features/expenses/lib/arithmetic'
import { fullFormFromExpense, parseStoredConfidence } from '@/features/expenses/lib/form'
import { CATEGORY_CONFIG, PAYMENT_METHOD_LABELS, STATUS_CONFIG } from '@/features/expenses/constants'
import { ReceiptGallery } from '@/features/expenses/components/ReceiptGallery'
import { StatusBadge } from '@/features/expenses/components/StatusBadge'
import { CategoryBadge } from '@/features/expenses/components/CategoryBadge'
import { ArithmeticWarning } from '@/features/expenses/components/ArithmeticWarning'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button, buttonStyles } from '@/shared/components/ui/Button'
import { Textarea } from '@/shared/components/ui/Field'
import { Modal } from '@/shared/components/ui/Modal'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { useToast } from '@/shared/components/ui/Toast'
import { formatDate, formatDateTime } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/errors'
import { cn } from '@/shared/lib/cn'

const REVIEW_REASON_LABELS: Record<string, string> = {
  not_receipt: 'La imagen no parece ser un recibo.',
  illegible: 'El recibo está ilegible o incompleto.',
  extraction_failed: 'La IA no pudo extraer los datos.',
  pdf_manual: 'PDF adjunto: los datos se completan manualmente.',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  merchant: 'Comercio',
  expenseDate: 'Fecha',
  date: 'Fecha',
  currency: 'Moneda',
  subtotal: 'Subtotal',
  tax: 'ITBIS',
  tip: 'Propina',
  total: 'Total',
  paymentMethod: 'Método de pago',
  rnc: 'RNC',
  ncf: 'NCF',
  category: 'Categoría',
}

export function ExpenseDetailPage() {
  useDocumentTitle('Detalle del gasto')
  const { expenseId } = useParams<{ expenseId: string }>()
  const { user, isAccountant } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const navigate = useNavigate()
  const { expense, loading, error, fromCache, refresh } = useExpense(expenseId)

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const imagePaths = useMemo(
    () =>
      expense
        ? expense.images.flatMap((image) => [image.storage_path, image.thumb_path].filter(Boolean) as string[])
        : [],
    [expense],
  )
  const { urls } = useSignedUrls(imagePaths)

  const confidence = useMemo(() => (expense ? parseStoredConfidence(expense.ai_confidence) : {}), [expense])
  const lowConfidenceFields = useMemo(
    () =>
      Object.entries(confidence)
        .filter(([, value]) => value < 0.7)
        .map(([key]) => CONFIDENCE_LABELS[key] ?? key),
    [confidence],
  )

  const arithmetic = useMemo(
    () => (expense ? checkArithmetic(fullFormFromExpense(expense)) : null),
    [expense],
  )

  if (loading) return <DetailSkeleton />
  if (error || !expense) {
    return (
      <div>
        <PageHeader title="Detalle del gasto" backTo="/expenses" backLabel="Volver a gastos" />
        <ErrorState
          title="No pudimos abrir este gasto"
          description={error ?? 'El gasto no existe o no tienes permiso para verlo.'}
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

  const isOwner = expense.user_id === user?.id
  const canEdit = isOwner && expense.status !== 'approved'
  const canReview = isAccountant && expense.status === 'confirmed'
  const reviewReason = expense.review_reason ? REVIEW_REASON_LABELS[expense.review_reason] : null

  const openApprove = () => {
    setActionError(null)
    setComment('')
    setApproveOpen(true)
  }

  const openReject = () => {
    setActionError(null)
    setComment('')
    setRejectOpen(true)
  }

  const handleApprove = async () => {
    setActing(true)
    setActionError(null)
    try {
      await approveExpense(expense.id, comment)
      setApproveOpen(false)
      setComment('')
      toast.success('Gasto aprobado. Ya cuenta en los totales.')
      refresh()
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos aprobar el gasto.'))
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!comment.trim()) {
      setActionError('Escribe el motivo del rechazo para que el empleado pueda corregirlo.')
      return
    }
    setActing(true)
    setActionError(null)
    try {
      await rejectExpense(expense.id, comment)
      setRejectOpen(false)
      setComment('')
      toast.success('Gasto rechazado. El empleado verá tu comentario.')
      refresh()
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos rechazar el gasto.'))
    } finally {
      setActing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setActionError(null)
    try {
      await deleteExpense(expense)
      toast.success('Gasto eliminado junto con sus imágenes.')
      window.dispatchEvent(new CustomEvent('rivo:expenses-changed'))
      navigate('/expenses', { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'No pudimos eliminar el gasto.'))
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recibo"
        title={expense.merchant?.trim() || 'Gasto sin comercio'}
        description={`${expenseSubtitle(expense)} · Registrado por ${profileName(expense.owner)}`}
        backTo="/expenses"
        backLabel="Volver a gastos"
        actions={
          <>
            {canEdit && (
              <Link
                to={`/expenses/${expense.id}/edit`}
                className={buttonStyles({ variant: 'secondary' })}
              >
                <Pencil className="size-4" aria-hidden />
                Editar
              </Link>
            )}
            {canReview && (
              <>
                <Button
                  variant="secondary"
                  onClick={openReject}
                  icon={<ShieldX className="size-4 text-berry-600" />}
                >
                  Rechazar
                </Button>
                <Button onClick={openApprove} icon={<ShieldCheck className="size-4" />}>
                  Aprobar
                </Button>
              </>
            )}
          </>
        }
      />

      {fromCache && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Estás viendo la copia guardada en este dispositivo. Algunas acciones requieren conexión.</span>
        </div>
      )}

      <StatusBanner
        expenseId={expense.id}
        status={expense.status}
        reviewReason={reviewReason}
        approvalComment={expense.approval_comment}
        canEdit={canEdit}
      />

      {actionError && !approveOpen && !rejectOpen && (
        <div className="mb-4 rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-2.5 text-sm text-berry-700" role="alert">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="space-y-4">
          <section className="card overflow-hidden p-3 sm:p-4">
            <ReceiptGallery images={expense.images} urls={urls} />
          </section>

          {expense.items.length > 0 && (
            <section className="card p-4 sm:p-5">
              <h2 className="font-display text-base font-bold tracking-tight text-ink">Líneas del recibo</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-canvas-deep/70 text-[0.6875rem] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-bold">
                        Descripción
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-bold">
                        Cant.
                      </th>
                      <th scope="col" className="hidden px-2 py-2 text-right font-bold sm:table-cell">
                        Precio
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-bold">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {expense.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-ink">{item.description}</td>
                        <td className="tabular px-2 py-2 text-right text-ink-soft">{item.quantity}</td>
                        <td className="tabular hidden px-2 py-2 text-right text-ink-soft sm:table-cell">
                          {item.unit_price === null ? '—' : formatMoney(item.unit_price, expense.currency)}
                        </td>
                        <td className="tabular px-3 py-2 text-right font-semibold text-ink">
                          {item.line_total === null ? '—' : formatMoney(item.line_total, expense.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card p-4 sm:p-5">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Datos fiscales y notas</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Detail label="RNC" value={expense.rnc} icon={Hash} />
              <Detail label="NCF" value={expense.ncf} icon={FileText} />
              <Detail
                label="Método de pago"
                value={expense.payment_method ? PAYMENT_METHOD_LABELS[expense.payment_method] : null}
                icon={CreditCard}
              />
              <Detail label="Categoría" value={CATEGORY_CONFIG[expense.category].label} icon={ReceiptText} />
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-faint">Notas</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                {expense.notes?.trim() || 'Sin notas.'}
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <section className="card overflow-hidden">
            <div className="bg-brand-950 px-5 py-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-200">
                  Total del recibo
                </p>
                <StatusBadge status={expense.status} className="bg-white/15 text-white" />
              </div>
              <p className="tabular mt-2 font-display text-[2.15rem] font-bold leading-none tracking-tight">
                {formatMoney(expense.total, expense.currency)}
              </p>
              <p className="mt-2 text-xs text-brand-200">
                {formatDate(expense.expense_date)} · {expense.currency}
              </p>
            </div>

            <div className="space-y-2 px-5 py-4">
              <AmountRow label="Subtotal" value={expense.subtotal} currency={expense.currency} />
              <AmountRow label="ITBIS" value={expense.tax} currency={expense.currency} />
              <AmountRow label="Propina" value={expense.tip} currency={expense.currency} />
              <div className="border-t border-line pt-2">
                <AmountRow label="Total" value={expense.total} currency={expense.currency} strong />
              </div>
              {arithmetic && (
                <div className="pt-1">
                  <ArithmeticWarning arithmetic={arithmetic} currency={expense.currency} showSuccess />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              <CategoryBadge category={expense.category} />
              <span className="inline-flex items-center gap-1 rounded-full bg-canvas-deep px-2.5 py-1 text-[0.6875rem] font-bold text-ink-soft">
                <CalendarDays className="size-3" aria-hidden />
                {formatDate(expense.expense_date, 'numeric')}
              </span>
              {expense.images.length > 1 && (
                <span className="rounded-full bg-canvas-deep px-2.5 py-1 text-[0.6875rem] font-bold text-ink-soft">
                  {expense.images.length} archivos
                </span>
              )}
            </div>
          </section>

          {canReview && (
            <section className="card border-sky-200 bg-sky-50/60 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-700" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-sky-900">Pendiente de tu aprobación</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-sky-800">
                    Revisa la imagen, los importes y la aritmética. Puedes aprobar o rechazar con un
                    comentario.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={openApprove} icon={<CheckCircle2 className="size-4" />}>
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={openReject}
                      icon={<ShieldX className="size-4 text-berry-600" />}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="card p-4 sm:p-5">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Trazabilidad</h2>
            <ol className="mt-3 space-y-3">
              <TimelineItem
                icon={CalendarDays}
                title="Creado"
                detail={formatDateTime(expense.created_at)}
              />
              <TimelineItem
                icon={UserRound}
                title="Registrado por"
                detail={profileName(expense.owner)}
              />
              {expense.submitted_at && (
                <TimelineItem
                  icon={CheckCircle2}
                  title="Enviado a revisión"
                  detail={formatDateTime(expense.submitted_at)}
                />
              )}
              {expense.reviewed_at && (
                <TimelineItem
                  icon={expense.status === 'approved' ? ShieldCheck : ShieldX}
                  title={expense.status === 'rejected' ? 'Rechazado' : 'Revisado'}
                  detail={`${formatDateTime(expense.reviewed_at)}${
                    expense.reviewer ? ` · ${profileName(expense.reviewer)}` : ''
                  }`}
                />
              )}
            </ol>
            {expense.approval_comment && (
              <div
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs leading-relaxed',
                  expense.status === 'rejected'
                    ? 'border-berry-200 bg-berry-50 text-berry-800'
                    : 'border-brand-200 bg-brand-50 text-brand-800',
                )}
              >
                <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-bold">Comentario de contabilidad</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{expense.approval_comment}</p>
                </div>
              </div>
            )}
          </section>

          {(expense.ai_notes || lowConfidenceFields.length > 0) && (
            <section className="card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-sun-500" aria-hidden />
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Análisis de la IA</h2>
              </div>
              {expense.ai_notes && (
                <p className="mt-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs leading-relaxed text-sun-800">
                  {expense.ai_notes}
                </p>
              )}
              {lowConfidenceFields.length > 0 && (
                <>
                  <p className="mt-3 text-xs text-ink-soft">Campos que la IA marcó con baja confianza:</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lowConfidenceFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full bg-sun-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-sun-700"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
                La IA nunca inventa datos: si un campo no aparece en el recibo, queda vacío.
              </p>
            </section>
          )}

          {isOwner && (
            <section className="card border-berry-100 p-4 sm:p-5">
              <h2 className="font-display text-base font-bold tracking-tight text-ink">Zona sensible</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Eliminar el gasto también borra las imágenes del almacenamiento. Esta acción no se puede
                deshacer.
              </p>
              <Button
                variant="secondary"
                className="mt-3 border-berry-200 text-berry-700 hover:bg-berry-50"
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setActionError(null)
                  setDeleteOpen(true)
                }}
                disabled={!online}
              >
                Eliminar gasto
              </Button>
              {!online && <p className="mt-2 text-[0.6875rem] text-ink-faint">Necesitas conexión para eliminar.</p>}
            </section>
          )}
        </div>
      </div>

      <Modal
        open={approveOpen}
        onClose={() => {
          if (!acting) setApproveOpen(false)
        }}
        title="Aprobar gasto"
        description="Quedará confirmado y contará en los totales del equipo."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={acting}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleApprove()}
              loading={acting}
              icon={<CheckCircle2 className="size-4" />}
            >
              Aprobar gasto
            </Button>
          </div>
        }
      >
        <label htmlFor="approve-comment" className="text-[0.8125rem] font-semibold text-ink-soft">
          Comentario <span className="font-normal text-ink-faint">(opcional)</span>
        </label>
        <Textarea
          id="approve-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Ej. Verificado contra la factura del proveedor."
          className="mt-1.5"
          maxLength={1000}
        />
        <p className="mt-1 text-xs text-ink-faint">El empleado verá este comentario en el detalle.</p>
        {actionError && <p className="mt-2 text-xs font-medium text-berry-600">{actionError}</p>}
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => {
          if (!acting) setRejectOpen(false)
        }}
        title="Rechazar gasto"
        description="El empleado podrá corregirlo y enviarlo de nuevo."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={acting}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleReject()}
              loading={acting}
              disabled={!comment.trim()}
              icon={<ShieldX className="size-4" />}
            >
              Rechazar gasto
            </Button>
          </div>
        }
      >
        <label htmlFor="reject-comment" className="text-[0.8125rem] font-semibold text-ink-soft">
          Motivo del rechazo <span className="text-berry-500">*</span>
        </label>
        <Textarea
          id="reject-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Ej. El total no coincide con la imagen. Corrige el ITBIS."
          className="mt-1.5"
          maxLength={1000}
          invalid={Boolean(actionError)}
          required
        />
        <p className="mt-1 text-xs text-ink-faint">Obligatorio. Sé claro para agilizar la corrección.</p>
        {actionError && <p className="mt-2 text-xs font-medium text-berry-600">{actionError}</p>}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false)
        }}
        onConfirm={() => void handleDelete()}
        title="¿Eliminar este gasto?"
        description="Se borrarán el recibo, las imágenes y las líneas de detalle. No se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      >
        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas/60 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
            <ReceiptText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{expense.merchant || 'Gasto sin comercio'}</p>
            <p className="text-xs text-ink-soft">
              {formatDate(expense.expense_date)} · {formatMoney(expense.total, expense.currency)}
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function StatusBanner({
  expenseId,
  status,
  reviewReason,
  approvalComment,
  canEdit,
}: {
  expenseId: string
  status: keyof typeof STATUS_CONFIG
  reviewReason: string | null
  approvalComment: string | null
  canEdit: boolean
}) {
  if (status === 'rejected') {
    return (
      <div className="mb-4 rounded-2xl border border-berry-200 bg-berry-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-berry-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-berry-800">Contabilidad rechazó este gasto</p>
            <p className="mt-0.5 text-xs leading-relaxed text-berry-700">
              {approvalComment || 'Revisa el recibo, corrige los datos y vuelve a confirmarlo.'}
            </p>
            {canEdit && (
              <Link
                to={`/expenses/${expenseId}/edit`}
                className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-3' })}
              >
                <Pencil className="size-3.5" aria-hidden />
                Corregir y reenviar
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'needs_review' || status === 'draft') {
    return (
      <div className="mb-4 rounded-2xl border border-sun-200 bg-sun-50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-sun-600" aria-hidden />
          <div>
            <p className="text-sm font-bold text-sun-800">
              {status === 'draft' ? 'Este gasto es un borrador' : 'Este gasto requiere tu revisión'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-sun-700">
              {reviewReason ??
                'La IA pudo extraer datos, pero conviene verificarlos antes de enviarlo a contabilidad.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'confirmed') {
    return (
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sky-600" aria-hidden />
          <div>
            <p className="text-sm font-bold text-sky-900">Esperando aprobación de contabilidad</p>
            <p className="mt-0.5 text-xs leading-relaxed text-sky-800">
              Este gasto ya fue confirmado y todavía no cuenta en los totales.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
        <div>
          <p className="text-sm font-bold text-brand-900">Gasto aprobado</p>
          <p className="mt-0.5 text-xs leading-relaxed text-brand-800">
            Verificado por contabilidad. Este es el único estado que suma en los totales del equipo.
          </p>
        </div>
      </div>
    </div>
  )
}

function AmountRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string
  value: number | null
  currency: 'DOP' | 'USD'
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-sm', strong ? 'font-bold text-ink' : 'text-ink-soft')}>{label}</span>
      <span className={cn('tabular text-sm', strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>
        {formatMoney(value, currency)}
      </span>
    </div>
  )
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | null
  icon: typeof Hash
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-canvas/40 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-faint">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{value || 'No indicado'}</dd>
      </div>
    </div>
  )
}

function TimelineItem({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof CalendarDays
  title: string
  detail: string
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas-deep text-ink-soft">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-faint">{detail}</p>
      </div>
    </li>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] rounded-2xl sm:aspect-[4/3]" />
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Cargando detalle del gasto
      </span>
    </div>
  )
}
