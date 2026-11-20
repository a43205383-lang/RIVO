import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { env } from '@/shared/lib/env'
import { SetupScreen } from '@/app/components/SetupScreen'
import { AppLayout } from '@/app/layouts/AppLayout'
import { NotFoundPage, PublicOnly, RequireAccountant, RequireAuth } from '@/app/routes/guards'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ExpensesPage } from '@/features/expenses/pages/ExpensesPage'
import { ExpenseDetailPage } from '@/features/expenses/pages/ExpenseDetailPage'
import { ReviewExpensePage } from '@/features/expenses/pages/ReviewExpensePage'
import { CapturePage } from '@/features/capture/pages/CapturePage'
import { SummaryPage } from '@/features/dashboard/pages/SummaryPage'
import { ApprovalsPage } from '@/features/approvals/pages/ApprovalsPage'
import { AskPage } from '@/features/reports/pages/AskPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export function App() {
  if (!env.configured) return <SetupScreen />

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/:expenseId" element={<ExpenseDetailPage />} />
            <Route path="expenses/:expenseId/review" element={<ReviewExpensePage mode="review" />} />
            <Route path="expenses/:expenseId/edit" element={<ReviewExpensePage mode="edit" />} />
            <Route path="capture" element={<CapturePage />} />
            <Route path="summary" element={<SummaryPage />} />
            <Route element={<RequireAccountant />}>
              <Route path="approvals" element={<ApprovalsPage />} />
            </Route>
            <Route path="ask" element={<AskPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
