import { LogoMark } from '@/shared/components/ui/Logo'
import { Database, KeyRound, TerminalSquare } from 'lucide-react'

const steps = [
  {
    icon: KeyRound,
    title: '1. Configura las variables públicas',
    body: 'Copia .env.example a .env.local y pega la URL y la anon key de tu proyecto de Supabase.',
    code: 'VITE_SUPABASE_URL=https://tu-proyecto.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...',
  },
  {
    icon: Database,
    title: '2. Ejecuta la migración SQL',
    body: 'En el SQL Editor de Supabase o con la CLI, aplica las migraciones de supabase/migrations/. Crean tablas, roles, RLS, bucket privado y políticas.',
    code: 'supabase db push',
  },
  {
    icon: TerminalSquare,
    title: '3. Despliega las Edge Functions',
    body: 'La llave de IA vive solo en el servidor. Configura el secreto y despliega la extracción y las consultas.',
    code: 'supabase secrets set OPENAI_API_KEY=sk-...\nsupabase functions deploy extract-receipt\nsupabase functions deploy ask-expenses',
  },
]

export function SetupScreen() {
  return (
    <div className="min-h-dvh px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <LogoMark className="size-11" />
          <div>
            <p className="font-display text-2xl font-bold tracking-[-0.04em] text-ink">Rivo</p>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Gastos claros
            </p>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-sun-600">
            Configuración pendiente
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.035em] text-ink sm:text-4xl">
            Conecta Supabase para encender Rivo
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            La interfaz está completa, pero no hay credenciales públicas configuradas. No necesitas
            tocar código: solo variables de entorno, la migración SQL y la función de IA.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {steps.map((step) => (
            <div key={step.title} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <step.icon className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold text-ink">{step.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-brand-950 px-3.5 py-3 text-xs leading-relaxed text-brand-100">
                    <code>{step.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface/70 p-5 text-sm leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Después de configurar</p>
          <p className="mt-1">
            Reinicia el servidor de desarrollo (<code className="rounded bg-canvas-deep px-1.5 py-0.5 text-xs">npm run dev</code>
            ) o vuelve a desplegar. Lee el README para los usuarios de prueba, el bucket privado y las
            variables de la Edge Function.
          </p>
        </div>
      </div>
    </div>
  )
}
