import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePenLine,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { STATUS_CONFIG } from '@/features/expenses/constants'
import type { ExpenseStatus } from '@/shared/types/domain'

const icons: Record<ExpenseStatus, typeof Clock3> = {
  draft: FilePenLine,
  needs_review: AlertTriangle,
  confirmed: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
}

export function StatusBadge({ status, className }: { status: ExpenseStatus; className?: string }) {
  const config = STATUS_CONFIG[status]
  const Icon = icons[status]
  return (
    <Badge
      tone={config.tone}
      className={className}
      icon={<Icon className="size-3" aria-hidden />}
    >
      {config.label}
    </Badge>
  )
}

export function StatusDot({ status }: { status: ExpenseStatus }) {
  const config = STATUS_CONFIG[status]
  const colors: Record<ExpenseStatus, string> = {
    draft: 'bg-ink-faint',
    needs_review: 'bg-sun-500',
    confirmed: 'bg-sky-500',
    approved: 'bg-brand-600',
    rejected: 'bg-berry-500',
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <span className={`size-2 rounded-full ${colors[status]}`} aria-hidden />
      {config.label}
    </span>
  )
}
