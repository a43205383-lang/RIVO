import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-55 active:translate-y-px focus-visible:outline-none focus-visible:ring-4'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white shadow-[0_8px_20px_-10px_rgba(15,90,75,0.8)] hover:bg-brand-800 focus-visible:ring-brand-200',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-canvas-deep focus-visible:ring-brand-100',
  ghost: 'text-ink-soft hover:bg-canvas-deep hover:text-ink focus-visible:ring-brand-100',
  danger: 'bg-berry-600 text-white hover:bg-berry-700 focus-visible:ring-berry-200',
  sun: 'bg-sun-400 text-brand-950 hover:bg-sun-300 focus-visible:ring-sun-200',
  dark: 'bg-brand-950 text-white hover:bg-brand-900 focus-visible:ring-brand-200',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-[0.8125rem]',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-[3.25rem] px-5 text-[0.9375rem]',
  icon: 'h-11 w-11 shrink-0',
}

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
} = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
