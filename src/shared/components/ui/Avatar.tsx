import { cn } from '@/shared/lib/cn'
import { initials } from '@/shared/lib/text'

export function Avatar({
  name,
  size = 'md',
  className,
  tone = 'brand',
}: {
  name: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
  tone?: 'brand' | 'sun'
}) {
  const sizes = {
    sm: 'size-8 text-[0.625rem]',
    md: 'size-10 text-xs',
    lg: 'size-14 text-base',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide',
        sizes[size],
        tone === 'brand' ? 'bg-brand-100 text-brand-800' : 'bg-sun-100 text-sun-700',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
