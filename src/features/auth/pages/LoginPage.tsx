import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthError, PasswordField } from '@/features/auth/components/PasswordField'
import { Button } from '@/shared/components/ui/Button'
import { Field, Input } from '@/shared/components/ui/Field'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { errorMessage } from '@/shared/lib/errors'

export function LoginPage() {
  useDocumentTitle('Entrar')
  const { signIn, authError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const confirmed = new URLSearchParams(location.search).get('confirmed') === '1'
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const nextErrors: typeof fieldErrors = {}
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Escribe un correo válido.'
    if (!password) nextErrors.password = 'Escribe tu contraseña.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const result = await signIn(email, password)
      if (result.error) {
        setError(result.error)
        return
      }
      navigate(from, { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos iniciar sesión. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-600">
          Bienvenido de vuelta
        </p>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink">
          Entra a tus gastos
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Revisa, captura y controla los recibos de tu equipo.
        </p>
      </div>

      {confirmed && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-800">
          <MailCheck className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          Correo confirmado. Ya puedes iniciar sesión.
        </div>
      )}

      {authError && <div className="mb-5"><AuthError>{authError}</AuthError></div>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="email" error={fieldErrors.email} required>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <div>
          <PasswordField
            id="password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" className="w-full" loading={loading} icon={<ArrowRight className="size-4.5" />}>
          Iniciar sesión
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  )
}
