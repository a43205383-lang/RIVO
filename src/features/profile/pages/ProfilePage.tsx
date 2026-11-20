import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudOff, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { AuthError, PasswordField } from '@/features/auth/components/PasswordField'
import { useOfflineQueue } from '@/features/offline/hooks/useOfflineQueue'
import { PageHeader } from '@/shared/components/ui/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { Avatar } from '@/shared/components/ui/Avatar'
import { Badge } from '@/shared/components/ui/Badge'
import { Field, Input } from '@/shared/components/ui/Field'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { useToast } from '@/shared/components/ui/Toast'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { formatDate } from '@/shared/lib/date'
import { errorMessage } from '@/shared/lib/errors'

export function ProfilePage() {
  useDocumentTitle('Mi perfil')
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnlineStatus()
  const queue = useOfflineQueue()
  const {
    user,
    profile,
    profileLoading,
    profileError,
    isAccountant,
    updateName,
    changePassword,
    signOut,
  } = useAuth()

  const [fullName, setFullName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
  }, [profile?.full_name])

  const handleSaveName = async () => {
    const trimmed = fullName.trim()
    if (trimmed.length < 2) {
      setNameError('Escribe al menos 2 caracteres.')
      return
    }
    if (trimmed.length > 80) {
      setNameError('El nombre no puede superar 80 caracteres.')
      return
    }
    setNameError(null)
    setSavingName(true)
    try {
      const result = await updateName(trimmed)
      if (result.error) {
        setNameError(result.error)
        toast.error(result.error)
        return
      }
      toast.success('Nombre actualizado.')
    } catch (caught) {
      const message = errorMessage(caught, 'No pudimos guardar el nombre.')
      setNameError(message)
      toast.error(message)
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }
    setPasswordError(null)
    setSavingPassword(true)
    try {
      const result = await changePassword(password)
      if (result.error) {
        setPasswordError(result.error)
        toast.error(result.error)
        return
      }
      setPassword('')
      setConfirmPassword('')
      toast.success('Contraseña actualizada.')
    } catch (caught) {
      const message = errorMessage(caught, 'No pudimos cambiar la contraseña.')
      setPasswordError(message)
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    const result = await signOut()
    setSigningOut(false)
    if (result.error) toast.error(result.error)
    else navigate('/login', { replace: true })
  }

  if (profileLoading && !profile) {
    return (
      <div className="bottom-nav-space mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="bottom-nav-space mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Tus datos, tu contraseña y el estado de los recibos pendientes de subir."
      />

      {profileError && (
        <div className="mb-4">
          <AuthError>{profileError}</AuthError>
        </div>
      )}

      <section className="card p-5" aria-label="Datos de la cuenta">
        <div className="flex items-start gap-4">
          <Avatar name={profile?.full_name || user?.email} size="lg" tone={isAccountant ? 'sun' : 'brand'} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold text-ink">
              {profile?.full_name || user?.email || 'Usuario'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-ink-soft">{user?.email ?? profile?.email ?? ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={isAccountant ? 'sun' : 'brand'} icon={<ShieldCheck className="size-3" />}>
                {isAccountant ? 'Contabilidad' : 'Empleado'}
              </Badge>
              {profile?.created_at && (
                <span className="text-xs text-ink-faint">Desde {formatDate(profile.created_at, 'long')}</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
          El rol de contabilidad lo asigna un administrador desde Supabase. Los gastos que confirmes quedarán
          pendientes de su aprobación.
        </p>
      </section>

      <section className="card mt-4 p-5" aria-label="Cambiar nombre">
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-brand-600" aria-hidden />
          <h2 className="font-display text-base font-bold text-ink">Nombre visible</h2>
        </div>
        <Field label="Nombre completo" htmlFor="profile-name" error={nameError ?? undefined}>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            placeholder="María Rodríguez"
            maxLength={80}
            invalid={Boolean(nameError)}
          />
        </Field>
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => void handleSaveName()}
            loading={savingName}
            disabled={savingName || fullName.trim() === (profile?.full_name ?? '')}
          >
            Guardar nombre
          </Button>
        </div>
      </section>

      <section className="card mt-4 p-5" aria-label="Cambiar contraseña">
        <h2 className="mb-4 font-display text-base font-bold text-ink">Contraseña</h2>
        <div className="space-y-4">
          <PasswordField
            id="new-password"
            label="Nueva contraseña"
            value={password}
            onChange={(value) => setPassword(value)}
            autoComplete="new-password"
            hint="Mínimo 8 caracteres."
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={(value) => setConfirmPassword(value)}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
          />
          <AuthError>{passwordError}</AuthError>
          <div className="flex justify-end">
            <Button
              onClick={() => void handleChangePassword()}
              loading={savingPassword}
              disabled={savingPassword || !password || !confirmPassword}
            >
              Actualizar contraseña
            </Button>
          </div>
        </div>
      </section>

      <section className="card mt-4 p-5" aria-label="Recibos pendientes">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sun-100 text-sun-700">
            <CloudOff className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-ink">Recibos sin subir</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {queue.count === 0
                ? 'No tienes recibos en espera. Todo lo que capturaste ya fue enviado.'
                : `Tienes ${queue.count} recibo${queue.count === 1 ? '' : 's'} guardado${queue.count === 1 ? '' : 's'} en este dispositivo.`}
            </p>
          </div>
        </div>
        {queue.count > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="size-4" />}
              onClick={() => void queue.process()}
              disabled={!online || queue.processing}
              loading={queue.processing}
            >
              Subir ahora
            </Button>
            {!online && <span className="text-xs text-ink-faint">Espera a tener conexión.</span>}
          </div>
        )}
      </section>

      <section className="card mt-4 p-5" aria-label="Sesión">
        <h2 className="mb-1 font-display text-base font-bold text-ink">Sesión</h2>
        <p className="mb-4 text-sm text-ink-soft">Cerrar sesión en este dispositivo.</p>
        <Button
          variant="secondary"
          icon={<LogOut className="size-4" />}
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          loading={signingOut}
        >
          Cerrar sesión
        </Button>
      </section>
    </div>
  )
}
