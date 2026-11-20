import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} role="img" aria-label="Rivo">
      <rect width="64" height="64" rx="16" fill="#0F3D33" />
      <path
        d="M19 15h26a3 3 0 0 1 3 3v30l-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5-4 3.5V18a3 3 0 0 1 3-3Z"
        fill="#FBF8F0"
      />
      <path d="M25 24h14M25 30h14M25 36h8" stroke="#0F3D33" strokeWidth="3" strokeLinecap="round" />
      <circle cx="45" cy="45" r="9" fill="#E8A93A" />
      <path
        d="m41.5 45 2.4 2.4 4.6-4.8"
        stroke="#0F3D33"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none', className)}
      aria-label="Rivo, ir al inicio"
    >
      <LogoMark className="size-9 shadow-[0_6px_14px_-8px_rgba(15,61,51,0.7)]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.35rem] font-bold tracking-[-0.04em] text-ink">Rivo</span>
          <span className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Gastos claros
          </span>
        </span>
      )}
    </Link>
  )
}
