import type { ReactNode } from 'react'
import { CheckCircle2, ScanLine, ShieldCheck, Sparkles } from 'lucide-react'
import { LogoMark } from '@/shared/components/ui/Logo'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.08fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="grain absolute inset-0 opacity-80" aria-hidden />
        <div
          className="absolute -right-24 -top-24 size-96 rounded-full border border-white/10"
          aria-hidden
        />
        <div
          className="absolute -bottom-40 -left-24 size-[32rem] rounded-full border border-white/10"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <LogoMark className="size-11" />
            <div>
              <p className="font-display text-2xl font-bold tracking-[-0.04em]">Rivo</p>
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-white/45">
                Gastos claros
              </p>
            </div>
          </div>

          <h2 className="mt-16 max-w-lg font-display text-[2.75rem] font-bold leading-[1.06] tracking-[-0.04em] xl:text-5xl">
            Cada recibo,
            <br />
            en su lugar.
          </h2>
          <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-white/65">
            Fotografía el recibo, deja que la IA extraiga los datos y revisa lo dudoso antes de
            guardar. Sin bolsillos llenos de papel.
          </p>

          <div className="mt-10 grid max-w-md gap-3">
            {[
              { icon: ScanLine, text: 'Captura con cámara o galería' },
              { icon: Sparkles, text: 'Extracción con visión artificial y confianza por campo' },
              { icon: ShieldCheck, text: 'Cada quien ve solo sus gastos; contabilidad aprueba' },
              { icon: CheckCircle2, text: 'Exporta a CSV y controla el mes en segundos' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/75">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-sun-300">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-12 max-w-sm rotate-[-2deg] rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-white/40">
              Recibo procesado
            </span>
            <span className="rounded-full bg-brand-400/20 px-2 py-0.5 text-[0.625rem] font-bold text-brand-200">
              IA · 94%
            </span>
          </div>
          <p className="mt-3 font-display text-lg font-bold">Supermercado del Este</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/5 px-2.5 py-2">
              <p className="text-white/40">Fecha</p>
              <p className="font-semibold text-white/85">19 nov 2026</p>
            </div>
            <div className="rounded-lg bg-white/5 px-2.5 py-2">
              <p className="text-white/40">Total</p>
              <p className="font-semibold text-white/85">RD$ 3,420.00</p>
            </div>
            <div className="rounded-lg bg-sun-400/15 px-2.5 py-2">
              <p className="text-sun-200/70">ITBIS</p>
              <p className="font-semibold text-sun-100">RD$ 521.69</p>
            </div>
            <div className="rounded-lg bg-white/5 px-2.5 py-2">
              <p className="text-white/40">Categoría</p>
              <p className="font-semibold text-white/85">Alimentos</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5 lg:hidden">
          <LogoMark className="size-9" />
          <div>
            <p className="font-display text-xl font-bold tracking-[-0.04em] text-ink">Rivo</p>
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Gastos claros
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[26rem] animate-fade-up">{children}</div>
        </div>
        <p className="text-center text-[0.6875rem] text-ink-faint">
          Rivo · Prueba técnica · Hecho para operaciones en República Dominicana
        </p>
      </main>
    </div>
  )
}
