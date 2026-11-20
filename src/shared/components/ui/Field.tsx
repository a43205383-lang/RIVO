import type { ComponentProps, ReactNode } from 'react'
import { AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

const controlBase =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink shadow-[inset_0_1px_1px_rgba(20,35,31,0.03)] transition-colors placeholder:text-ink-faint/70 disabled:cursor-not-allowed disabled:bg-canvas-deep disabled:text-ink-faint'

export function controlStyles({
  invalid,
  lowConfidence,
  className,
}: {
  invalid?: boolean
  lowConfidence?: boolean
  className?: string
} = {}) {
  return cn(
    controlBase,
    'min-h-12 border-line-strong hover:border-ink-faint/60 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100',
    invalid && 'border-berry-400 bg-berry-50/60 focus:border-berry-500 focus:ring-berry-100',
    lowConfidence && !invalid && 'border-sun-400 bg-sun-50/70 focus:border-sun-500 focus:ring-sun-100',
    className,
  )
}

export function Input({
  className,
  invalid,
  lowConfidence,
  ...props
}: ComponentProps<'input'> & { invalid?: boolean; lowConfidence?: boolean }) {
  return (
    <input
      className={controlStyles({ invalid, lowConfidence, className })}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Textarea({
  className,
  invalid,
  lowConfidence,
  ...props
}: ComponentProps<'textarea'> & { invalid?: boolean; lowConfidence?: boolean }) {
  return (
    <textarea
      className={controlStyles({ invalid, lowConfidence, className: cn('min-h-24 resize-y', className) })}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Select({
  className,
  invalid,
  lowConfidence,
  ...props
}: ComponentProps<'select'> & { invalid?: boolean; lowConfidence?: boolean }) {
  return (
    <select
      className={controlStyles({ invalid, lowConfidence, className: cn('appearance-none pr-9', className) })}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  confidence?: number | null
  required?: boolean
  optional?: boolean
  children: ReactNode
  className?: string
  trailingLabel?: ReactNode
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  confidence,
  required,
  optional,
  children,
  className,
  trailingLabel,
}: FieldProps) {
  const lowConfidence = typeof confidence === 'number' && confidence < 0.7

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={htmlFor} className="text-[0.8125rem] font-semibold text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-berry-500">*</span>}
          {optional && <span className="ml-1 font-normal text-ink-faint">(opcional)</span>}
        </label>
        <div className="flex items-center gap-1.5">
          {lowConfidence && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sun-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-sun-700">
              <Sparkles className="size-3" aria-hidden />
              Baja confianza
            </span>
          )}
          {trailingLabel}
        </div>
      </div>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-berry-600" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
}
