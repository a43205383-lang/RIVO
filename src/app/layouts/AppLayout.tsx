import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Home,
  LogOut,
  PieChart,
  Plus,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { useOfflineQueue } from '@/features/offline/hooks/useOfflineQueue'
import { OfflineBanner } from '@/features/offline/components/OfflineBanner'
import { countPendingApprovals } from '@/features/expenses/api/expensesApi'
import { clearSignedUrlCache } from '@/features/expenses/api/storageApi'
import { clearExpenseCache } from '@/features/expenses/lib/cache'
import { Logo } from '@/shared/components/ui/Logo'
import { Avatar } from '@/shared/components/ui/Avatar'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useToast } from '@/shared/components/ui/Toast'
import { cn } from '@/shared/lib/cn'
import { buttonStyles } from '@/shared/components/ui/Button'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/expenses', label: 'Gastos', icon: ReceiptText, end: false },
  { to: '/summary', label: 'Resumen', icon: PieChart, end: false },
  { to: '/ask', label: 'Consultas IA', icon: Sparkles, end: false },
  { to: '/profile', label: 'Perfil', icon: UserRound, end: false },
]

const mobileItems = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/expenses', label: 'Gastos', icon: ReceiptText, end: false },
  { to: '/summary', label: 'Resumen', icon: PieChart, end: false },
  { to: '/profile', label: 'Perfil', icon: UserRound, end: false },
]

export function AppLayout() {
  const { profile, profileError, isAccountant, signOut, reloadProfile } = useAuth()
  const online = useOnlineStatus()
  const queue = useOfflineQueue()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [pending, setPending] = useState(0)
  const [signingOut, setSigningOut] = useState(false)

  const refreshPending = useCallback(async () => {
    if (!isAccountant) {
      setPending(0)
      return
    }
    try {
      setPending(await countPendingApprovals())
    } catch {
      setPending(0)
    }
  }, [isAccountant])

  useEffect(() => {
    void refreshPending()
    const handleExpensesChanged = () => void refreshPending()
    window.addEventListener('rivo:expenses-changed', handleExpensesChanged)
    window.addEventListener('focus', handleExpensesChanged)
    return () => {
      window.removeEventListener('rivo:expenses-changed', handleExpensesChanged)
      window.removeEventListener('focus', handleExpensesChanged)
    }
  }, [refreshPending, location.pathname])

  useEffect(() => {
    const handleUpdate = () => toast.info('Hay una versión nueva de Rivo. Cierra la app y ábrela otra vez.')
    window.addEventListener('rivo:sw-updated', handleUpdate)
    return () => window.removeEventListener('rivo:sw-updated', handleUpdate)
  }, [toast])

  const handleSignOut = async () => {
    if (profile) clearExpenseCache(profile.id)
    clearSignedUrlCache()
    setSigningOut(true)
    const result = await signOut()
    setSigningOut(false)
    if (result.error) toast.error(result.error)
    else navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-line bg-surface/95 backdrop-blur lg:flex">
        <div className="flex h-full flex-col px-5 py-6">
          <Logo />
          <LinkToCapture className="mt-7" />

          <nav className="mt-7 space-y-1" aria-label="Navegación principal">
            {navItems.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
            {isAccountant && (
              <SidebarLink
                to="/approvals"
                label="Aprobaciones"
                icon={ShieldCheck}
                end={false}
                badge={pending > 0 ? pending : undefined}
              />
            )}
          </nav>

          <div className="mt-auto space-y-3">
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/60 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/60"
            >
              <Avatar name={profile?.full_name || profile?.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {profile?.full_name || profile?.email || 'Usuario'}
                </p>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-brand-600">
                  {isAccountant ? 'Contador' : 'Empleado'}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-berry-50 hover:text-berry-700 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
            <p className="px-3 text-[0.625rem] text-ink-faint">Rivo · v1.0 · PWA</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-md lg:hidden">
          <div className="safe-top flex items-center justify-between px-4 pb-2.5">
            <Logo compact />
            <div className="flex items-center gap-1">
              {isAccountant && (
                <NavLink
                  to="/approvals"
                  className="relative flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-canvas-deep"
                  aria-label={`Aprobaciones${pending > 0 ? `: ${pending} pendientes` : ''}`}
                >
                  <Bell className="size-5" />
                  {pending > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-berry-500 text-[0.5625rem] font-bold text-white">
                      {pending > 9 ? '9+' : pending}
                    </span>
                  )}
                </NavLink>
              )}
              <NavLink
                to="/profile"
                className="rounded-full focus-visible:outline-none"
                aria-label="Perfil"
              >
                <Avatar name={profile?.full_name || profile?.email} size="sm" />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="bottom-nav-space mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8 lg:py-8">
          <OfflineBanner
            online={online}
            queueCount={queue.count}
            processing={queue.processing}
            onRetry={() => void queue.process()}
          />
          {profileError && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3 text-sm text-sun-800">
              <span>{profileError}</span>
              <button
                type="button"
                onClick={() => void reloadProfile()}
                className="font-bold underline underline-offset-4"
              >
                Reintentar
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Navegación móvil"
      >
        <div className="mx-auto grid h-[4.5rem] max-w-md grid-cols-5 items-end px-2">
          {mobileItems.slice(0, 2).map((item) => (
            <MobileLink key={item.to} {...item} />
          ))}

          <div className="flex justify-center">
            <NavLink
              to="/capture"
              className="-mt-6 flex size-[3.75rem] flex-col items-center justify-center rounded-full border-4 border-canvas bg-brand-800 text-white shadow-[0_14px_28px_-10px_rgba(15,61,51,0.65)] transition-transform active:scale-95"
              aria-label="Escanear recibo"
            >
              <ScanLine className="size-6" aria-hidden />
            </NavLink>
          </div>

          {mobileItems.slice(2).map((item) => (
            <MobileLink key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function LinkToCapture({ className }: { className?: string }) {
  return (
    <NavLink
      to="/capture"
      className={cn(
        buttonStyles({ variant: 'primary', size: 'lg', className: 'w-full shadow-none' }),
        className,
      )}
    >
      <Plus className="size-5" aria-hidden />
      Nuevo gasto
    </NavLink>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string
  label: string
  icon: typeof Home
  end: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-800'
            : 'text-ink-soft hover:bg-canvas-deep hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[1.15rem]', isActive ? 'text-brand-700' : 'text-ink-faint')} aria-hidden />
          <span className="flex-1">{label}</span>
          {badge ? (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-berry-500 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function MobileLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.625rem] font-semibold transition-colors',
          isActive ? 'text-brand-800' : 'text-ink-faint hover:text-ink-soft',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[1.15rem]', isActive && 'text-brand-700')} aria-hidden />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}
