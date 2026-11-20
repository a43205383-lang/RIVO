import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { FullPageLoader } from '@/shared/components/ui/Spinner'
import { Button, buttonStyles } from '@/shared/components/ui/Button'
import { Logo } from '@/shared/components/ui/Logo'
import { PageHeader } from '@/shared/components/ui/PageHeader'

export function RequireAuth() {
  const { user, loading, profileLoading, profile } = useAuth()
  const location = useLocation()

  if (loading || (user && profileLoading && !profile)) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireAccountant() {
  const { isAccountant, profileLoading } = useAuth()
  if (profileLoading) return <FullPageLoader />
  if (!isAccountant) {
    return (
      <div>
        <PageHeader title="Aprobaciones" />
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-berry-50 text-berry-600">
            <ShieldX className="size-7" aria-hidden />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">Solo para contabilidad</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Tu cuenta es de empleado. Pide a un administrador que cambie tu rol a contador si necesitas
            revisar los gastos del equipo.
          </p>
          <Link to="/" className={buttonStyles({ variant: 'secondary', className: 'mt-6' })}>
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }
  return <Outlet />
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Logo className="mb-8" />
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-brand-600">Error 404</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Esta pantalla no existe</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Puede que el enlace esté roto o que el gasto se haya eliminado.
      </p>
      <Button className="mt-6" onClick={() => window.location.assign('/')}>
        Ir al inicio
      </Button>
    </div>
  )
}
