import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en Rivo', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
        <div className="card w-full max-w-md p-7 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-berry-50 text-berry-600">
            <AlertTriangle className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Algo se rompió</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Ocurrió un error inesperado en la interfaz. Tus gastos guardados siguen seguros en Supabase.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              <RefreshCw className="size-4" aria-hidden />
              Recargar la app
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas-deep"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
