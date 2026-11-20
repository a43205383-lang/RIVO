import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, Input } from '@/shared/components/ui/Field'

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  error,
  hint,
  placeholder = '••••••••',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  error?: string
  hint?: string
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          invalid={Boolean(error)}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-faint transition-colors hover:text-ink"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      </div>
    </Field>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="rounded-xl border border-berry-200 bg-berry-50 px-3.5 py-3 text-sm font-medium text-berry-700" role="alert">
      {children}
    </div>
  )
}
