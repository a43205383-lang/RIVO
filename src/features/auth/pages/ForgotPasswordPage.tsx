import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/providers/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthError } from '@/features/auth/components/PasswordField'
import { Button } from '@/shared/components/ui/Button'
import { Field, Input } from '@/shared/components/ui/Field'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'

export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña')
  const { requestReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Escribe un correo válido.')
      return
    }
    setLoading(true)
    const result = await requestReset(email)
    setLoading(false)
    if (result.error) setError(result.error)
    else setSent(true)
  }

  return (
    <AuthLayout>
      <Link
        to="/login"
        className="mb-6 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-brand-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      {sent ? (
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <MailCheck className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Revisa tu correo</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Si existe una cuenta con <strong className="text-ink">{email}</strong>, recibirás un enlace
            para restablecer tu contraseña.
          </p>
          <Button className="mt-6 w-full" onClick={() => (window.location.href = '/login')}>
            Ir a iniciar sesión
          </Button>
        </div>
      ) : (
        <>
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink">
            Recupera tu acceso
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Te enviaremos un enlace seguro para crear una contraseña nueva.
          </p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <Field label="Correo electrónico" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            {error && <AuthError>{error}</AuthError>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Enviar enlace
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
