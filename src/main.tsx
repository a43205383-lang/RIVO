import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@/app/styles/global.css'
import { App } from '@/app/App'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { AuthProvider } from '@/features/auth/providers/AuthProvider'
import { ToastProvider } from '@/shared/components/ui/Toast'
import { registerServiceWorker } from '@/features/pwa/lib/registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
