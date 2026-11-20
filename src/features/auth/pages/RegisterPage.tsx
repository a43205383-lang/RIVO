import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthError, PasswordField } from '@/features/auth/components/PasswordField'
import { Button } from '@/shared/components/ui/Button'
import { Field, Input } from '@/shared/components/ui/Field'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { errorMessage } from '@/shared/lib/errors'

export function RegisterPage() {
  useDocumentTitle('Crear cuenta')
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const nextErrors: Record<string, string> = {}
    if (fullName.trim().length < 2) nextErrors.fullName = 'Escribe tu nombre completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Escribe un correo válido.'
    if (password.length < 8) nextErrors.password = 'Usa al menos 8 caracteres.'
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const result = await signUp(email, password, fullName)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.needsEmailConfirmation) {
        setNeedsConfirmation(true)
        return
      }
      navigate('/', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos crear la cuenta. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <AuthLayout>
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <MailCheck className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Revisa tu correo</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Enviamos un enlace de confirmación a <strong className="text-ink">{email}</strong>. Ábrelo y
            luego vuelve para iniciar sesión.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')}>
            Volver a iniciar sesión
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-600">
          Nueva cuenta
        </p>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink">
          Empieza a ordenar
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Tu cuenta será de empleado. Contabilidad puede darte acceso de contador después.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Nombre completo" htmlFor="fullName" error={fieldErrors.fullName} required>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="María Rodríguez"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            invalid={Boolean(fieldErrors.fullName)}
          />
        </Field>

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

        <PasswordField
          id="password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fieldErrors.password}
          hint="Mínimo 8 caracteres."
        />

        <PasswordField
          id="confirmPassword"
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" className="w-full" loading={loading} icon={<ArrowRight className="size-4.5" />}>
          Crear cuenta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
