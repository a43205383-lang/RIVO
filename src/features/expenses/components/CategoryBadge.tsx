import {
  Briefcase,
  Car,
  Fuel,
  PlugZap,
  Shapes,
  UtensilsCrossed,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { CATEGORY_CONFIG } from '@/features/expenses/constants'
import { cn } from '@/shared/lib/cn'
import type { ExpenseCategory } from '@/shared/types/domain'

const icons: Record<ExpenseCategory, typeof UtensilsCrossed> = {
  alimentos: UtensilsCrossed,
  combustible: Fuel,
  transporte: Car,
  oficina: Briefcase,
  servicios: PlugZap,
  otros: Shapes,
}

export function CategoryIcon({ category, className }: { category: ExpenseCategory; className?: string }) {
  const Icon = icons[category]
  return <Icon className={cn('size-4', className)} aria-hidden />
}

export function CategoryBadge({ category, className }: { category: ExpenseCategory; className?: string }) {
  const config = CATEGORY_CONFIG[category]
  return (
    <Badge tone={config.tone} className={className}>
      <CategoryIcon category={category} className="size-3" />
      {config.label}
    </Badge>
  )
}

export function CategoryTile({ category }: { category: ExpenseCategory }) {
  const config = CATEGORY_CONFIG[category]
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-canvas-deep text-brand-700">
        <CategoryIcon category={category} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">{config.label}</span>
        <span className="block text-xs text-ink-faint">{config.description}</span>
      </span>
    </span>
  )
}
