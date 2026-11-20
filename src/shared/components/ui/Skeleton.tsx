import { cn } from '@/shared/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-xl', className)} />
}

export function ExpenseRowSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <Skeleton className="size-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

export function ExpenseListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-label="Cargando gastos" role="status">
      {Array.from({ length: count }, (_, index) => (
        <ExpenseRowSkeleton key={index} />
      ))}
    </div>
  )
}

export function SummarySkeleton() {
  return (
    <div className="card space-y-5 p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-3 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
