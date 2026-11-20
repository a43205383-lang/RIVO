import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Lightbulb,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { askExpenses, type AskExpenseRow, type AskResult } from '@/features/reports/api/askApi'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { Textarea } from '@/shared/components/ui/Field'
import { useToast } from '@/shared/components/ui/Toast'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/errors'
import { STATUS_CONFIG, CATEGORY_CONFIG } from '@/features/expenses/constants'
import { cn } from '@/shared/lib/cn'

interface Exchange {
  id: string
  question: string
  answer: string | null
  rows: AskExpenseRow[]
  error: string | null
  meta?: AskResult['meta']
}

const EMPLOYEE_SUGGESTIONS = [
  '¿Cuánto gasté en combustible este mes?',
  '¿Cuál fue el total aprobado en alimentos el mes pasado?',
  '¿Cuáles son mis gastos más altos de los últimos 30 días?',
  '¿Cuánto suman mis gastos de transporte este mes?',
]

const ACCOUNTANT_SUGGESTIONS = [
  '¿Cuánto ha gastado el equipo este mes?',
  '¿Cuáles son los gastos más altos del mes?',
  '¿Cuánto se aprobó en alimentos el mes pasado?',
  '¿Qué gastos están pendientes de aprobación?',
]

export function AskPage() {
  useDocumentTitle('Consultas IA')
  const { isAccountant } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [asking, setAsking] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = isAccountant ? ACCOUNTANT_SUGGESTIONS : EMPLOYEE_SUGGESTIONS

  useEffect(() => {
    if (exchanges.length === 0) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [exchanges.length, asking])

  const runAsk = async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < 3) {
      setInputError('Escribe una pregunta de al menos 3 caracteres.')
      inputRef.current?.focus()
      return
    }
    if (!online || asking) return

    setInputError(null)
    setQuestion('')
    const id = crypto.randomUUID()
    setExchanges((current) => [
      ...current,
      { id, question: trimmed, answer: null, rows: [], error: null },
    ])
    setAsking(true)

    try {
      const result = await askExpenses(trimmed)
      setExchanges((current) =>
        current.map((exchange) =>
          exchange.id === id
            ? {
                ...exchange,
                answer: result.answer,
                rows: result.rows,
                meta: result.meta,
                error: null,
              }
            : exchange,
        ),
      )
    } catch (caught) {
      setExchanges((current) =>
        current.map((exchange) =>
          exchange.id === id
            ? {
                ...exchange,
                error: errorMessage(caught, 'No pudimos responder la consulta.'),
              }
            : exchange,
        ),
      )
    } finally {
      setAsking(false)
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!question.trim()) {
      setInputError('Escribe una pregunta sobre tus gastos.')
      return
    }
    void runAsk(question)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (question.trim()) void runAsk(question)
    }
  }

  const retry = (exchange: Exchange) => {
    setExchanges((current) => current.filter((item) => item.id !== exchange.id))
    void runAsk(exchange.question)
  }

  const clear = () => {
    if (asking) return
    setExchanges([])
    setInputError(null)
    toast.info('Historial de consultas borrado.')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Consulta en lenguaje natural"
        title="Pregunta sobre tus gastos"
        description="La IA traduce tu pregunta a una consulta segura sobre los gastos aprobados. No ejecuta SQL libre ni inventa cifras."
        actions={
          exchanges.length > 0 ? (
            <Button
              variant="ghost"
              onClick={clear}
              disabled={asking}
              icon={<Trash2 className="size-4" />}
            >
              Limpiar
            </Button>
          ) : undefined
        }
      />

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3.5 py-2.5 text-xs text-sun-800">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Las consultas necesitan conexión: la IA se ejecuta en el servidor, nunca en tu navegador.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {exchanges.length === 0 ? (
            <section className="card overflow-hidden">
              <div className="relative overflow-hidden bg-brand-950 px-5 py-7 text-white sm:px-7">
                <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-brand-700/40 blur-2xl" aria-hidden />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wide text-brand-100">
                    <Sparkles className="size-3" aria-hidden />
                    IA con datos reales
                  </span>
                  <h2 className="mt-3 max-w-xl font-display text-2xl font-bold leading-tight tracking-tight sm:text-[1.7rem]">
                    «¿Cuánto gasté en combustible este mes?»
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-200">
                    Escribe como hablarías. Rivo consulta únicamente tus gastos aprobados
                    {isAccountant ? ' (o los de todo el equipo, según tu rol)' : ''} y responde con
                    cifras verificables.
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
                  Prueba con una de estas
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void runAsk(suggestion)}
                      disabled={!online || asking}
                      className="group flex min-h-[3.25rem] items-center justify-between gap-2 rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 text-left text-sm font-medium text-ink-soft transition-colors hover:border-brand-200 hover:bg-brand-50/60 hover:text-ink disabled:opacity-50"
                    >
                      <span>{suggestion}</span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[0.6875rem] leading-relaxed text-ink-soft">
                  <Lock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                  <p>
                    Tu pregunta viaja a una Edge Function autenticada. El modelo recibe un resumen
                    estructurado y filtrado por RLS; la llave de IA nunca llega al navegador.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              {exchanges.map((exchange) => (
                <div key={exchange.id} className="space-y-2.5">
                  <div className="flex items-start justify-end gap-2.5">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-800 px-4 py-3 text-sm leading-relaxed text-white shadow-card">
                      {exchange.question}
                    </div>
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                      <UserRound className="size-4" aria-hidden />
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-100 text-sun-700">
                      <Bot className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 max-w-[92%] flex-1">
                      {exchange.answer === null && !exchange.error ? (
                        <div className="card flex items-center gap-3 px-4 py-3.5">
                          <span className="flex gap-1" aria-hidden>
                            <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:0ms]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:120ms]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:240ms]" />
                          </span>
                          <span className="text-xs font-medium text-ink-soft">
                            Consultando tus gastos aprobados…
                          </span>
                        </div>
                      ) : exchange.error ? (
                        <div className="card border-berry-200 bg-berry-50 p-4" role="alert">
                          <p className="text-sm font-semibold text-berry-800">No pudimos responder</p>
                          <p className="mt-1 text-xs leading-relaxed text-berry-700">{exchange.error}</p>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-3"
                            onClick={() => retry(exchange)}
                            disabled={!online || asking}
                            icon={<RefreshCw className="size-3.5" />}
                          >
                            Reintentar
                          </Button>
                        </div>
                      ) : (
                        <div className="card p-4">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                            {exchange.answer}
                          </p>

                          {exchange.rows.length > 0 && (
                            <div className="mt-3 border-t border-line pt-3">
                              <p className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-faint">
                                Gastos usados para responder
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {exchange.rows.slice(0, 8).map((row) => (
                                  <li key={row.id}>
                                    <Link
                                      to={`/expenses/${row.id}`}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-canvas/40 px-2.5 py-2 text-xs transition-colors hover:border-brand-200 hover:bg-brand-50/50"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-semibold text-ink">
                                          {row.merchant || 'Sin comercio'}
                                        </span>
                                        <span className="block text-[0.625rem] text-ink-faint">
                                          {formatDate(row.expense_date)} ·{' '}
                                          {CATEGORY_CONFIG[row.category].label} ·{' '}
                                          {STATUS_CONFIG[row.status].label}
                                        </span>
                                      </span>
                                      <span className="tabular shrink-0 font-bold text-ink">
                                        {formatMoney(row.total, row.currency)}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                              {exchange.rows.length > 8 && (
                                <p className="mt-1.5 text-[0.625rem] text-ink-faint">
                                  y {exchange.rows.length - 8} gasto
                                  {exchange.rows.length - 8 === 1 ? '' : 's'} más incluido
                                  {exchange.rows.length - 8 === 1 ? '' : 's'} en el cálculo.
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-[0.625rem] text-ink-faint">
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="size-3" aria-hidden />
                              Solo datos aprobados
                            </span>
                            {typeof exchange.meta?.remaining === 'number' && (
                              <span>· Consultas restantes hoy: {exchange.meta.remaining}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="card p-3 sm:p-4">
            <label htmlFor="ask-question" className="sr-only">
              Pregunta sobre tus gastos
            </label>
            <Textarea
              ref={inputRef}
              id="ask-question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value)
                if (inputError) setInputError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                online
                  ? 'Ej. ¿Cuánto gasté en alimentos en los últimos 30 días?'
                  : 'Sin conexión no podemos consultar la IA'
              }
              className="min-h-20 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus:ring-0"
              maxLength={500}
              disabled={!online || asking}
              invalid={Boolean(inputError)}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2.5">
              <p className="text-[0.625rem] leading-relaxed text-ink-faint">
                {inputError ? (
                  <span className="font-semibold text-berry-600">{inputError}</span>
                ) : (
                  <>
                    Enter para enviar · Shift + Enter para salto de línea
                    {question.length > 0 && ` · ${question.length}/500`}
                  </>
                )}
              </p>
              <Button
                type="submit"
                loading={asking}
                disabled={!online || !question.trim()}
                icon={<Send className="size-4" />}
              >
                Preguntar
              </Button>
            </div>
          </form>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6">
          <section className="card p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-sun-500" aria-hidden />
              <h2 className="font-display text-base font-bold tracking-tight text-ink">Buenas preguntas</h2>
            </div>
            <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-ink-soft">
              <li>· Di el periodo: «este mes», «agosto», «últimos 30 días».</li>
              <li>· Menciona categoría, comercio o moneda si aplica.</li>
              <li>· Pide comparaciones: «¿gasté más en julio o agosto?».</li>
              <li>· Evita pedir datos personales o de otros empleados.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-900">Respuestas con fuente</p>
                <p className="mt-0.5 text-xs leading-relaxed text-brand-800">
                  Cada respuesta incluye los gastos que la sustentan. Toca uno para abrir el recibo y
                  verificar la cifra.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface/60 p-4">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Privacidad</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  La IA recibe solo datos estructurados de gastos que tu rol puede ver. No recibe
                  imágenes ni credenciales, y no puede modificar registros.
                </p>
              </div>
            </div>
          </section>

          <Link
            to="/expenses"
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-200 hover:bg-brand-50/50',
            )}
          >
            Revisar gastos manualmente
            <ArrowRight className="size-4 text-ink-faint" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  )
}
