import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  success: 'border-brand-200 bg-brand-50 text-brand-900',
  error: 'border-berry-200 bg-berry-50 text-berry-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 shrink-0" aria-hidden />,
  error: <AlertCircle className="size-5 shrink-0" aria-hidden />,
  info: <Info className="size-5 shrink-0" aria-hidden />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID()
      setItems((current) => [...current.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4200)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
      info: (message: string) => toast(message, 'info'),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:justify-end sm:px-5">
          <div className="flex w-full max-w-sm flex-col gap-2" aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm font-medium shadow-card backdrop-blur',
                  toneStyles[item.tone],
                )}
                role={item.tone === 'error' ? 'alert' : 'status'}
              >
                <span className="mt-0.5">{icons[item.tone]}</span>
                <p className="flex-1 leading-snug">{item.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="mt-0.5 rounded-full p-1 opacity-60 transition hover:opacity-100"
                  aria-label="Cerrar aviso"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
