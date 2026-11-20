import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthError, PasswordField } from '@/features/auth/components/PasswordField'
import { Button } from '@/shared/components/ui/Button'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { errorMessage } from '@/shared/lib/errors'

export function ResetPasswordPage() {
  useDocumentTitle('Nueva contraseña')
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Usa al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const result = await changePassword(password)
      if (result.error) setError(result.error)
      else setDone(true)
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos actualizar la contraseña. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {!user ? (
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-sun-100 text-sun-700">
            <KeyRound className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Enlace requerido</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Abre el enlace que enviamos a tu correo para crear una contraseña nueva. Si el enlace venció,
            solicita otro.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/forgot-password')}>
            Solicitar enlace
          </Button>
        </div>
      ) : done ? (
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <CheckCircle2 className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Contraseña actualizada</h1>
          <p className="mt-2 text-sm text-ink-soft">Ya puedes seguir usando Rivo con tu nueva contraseña.</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>
            Ir a la app
          </Button>
        </div>
      ) : (
        <>
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink">
            Crea una contraseña nueva
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Usa al menos 8 caracteres y no reutilices una contraseña anterior.
          </p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <PasswordField
              id="password"
              label="Contraseña nueva"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirmPassword"
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            {error && <AuthError>{error}</AuthError>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Guardar contraseña
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-ink-soft">
            <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
