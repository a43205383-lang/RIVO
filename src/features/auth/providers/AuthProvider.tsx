import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'
import type { ProfileRow } from '@/shared/types/database.types'
import {
  fetchProfileWithRetry,
  requestPasswordReset,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
  updateFullName,
  updatePassword,
  type AuthResult,
} from '@/features/auth/api/authApi'

interface AuthContextValue {
  configured: boolean
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  authError: string | null
  profileLoading: boolean
  profileError: string | null
  isAccountant: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  requestReset: (email: string) => Promise<AuthResult>
  changePassword: (password: string) => Promise<AuthResult>
  updateName: (fullName: string) => Promise<AuthResult>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(env.configured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const hydrateProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    setProfileError(null)
    try {
      const nextProfile = await withTimeout(fetchProfileWithRetry(nextUser.id), 12_000)
      setProfile(nextProfile)
    } catch {
      setProfile(null)
      setProfileError('No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!env.configured) {
      setLoading(false)
      return
    }

    let active = true

    void withTimeout(supabase.auth.getSession(), 12_000)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setSession(null)
          setUser(null)
          setAuthError('No pudimos recuperar tu sesión. Intenta iniciar sesión de nuevo.')
          setLoading(false)
          return
        }
        setAuthError(null)
        setSession(data.session)
        setUser(data.session?.user ?? null)
        if (data.session?.user) {
          void hydrateProfile(data.session.user).finally(() => {
            if (active) setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setUser(null)
        setProfile(null)
        setAuthError('No pudimos recuperar tu sesión. Intenta iniciar sesión de nuevo.')
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession) setAuthError(null)
      if (!nextSession) {
        setProfile(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }
      // Supabase recommends not awaiting other auth calls inside this callback.
      window.setTimeout(() => {
        if (active) void hydrateProfile(nextSession.user)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [hydrateProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    return signInWithPassword(email, password)
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    return signUpWithPassword(email, password, fullName)
  }, [])

  const signOut = useCallback(async () => {
    const result = await signOutRequest()
    if (!result.error) {
      setProfile(null)
      setSession(null)
      setUser(null)
    }
    return result
  }, [])

  const requestReset = useCallback((email: string) => requestPasswordReset(email), [])
  const changePassword = useCallback((password: string) => updatePassword(password), [])

  const updateName = useCallback(
    async (fullName: string) => {
      if (!user) return { error: 'No hay una sesión activa.' }
      const result = await updateFullName(user.id, fullName)
      if (!result.error) await hydrateProfile(user)
      return result
    },
    [user, hydrateProfile],
  )

  const reloadProfile = useCallback(async () => {
    await hydrateProfile(user)
  }, [user, hydrateProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: env.configured,
      user,
      session,
      profile,
      loading,
      authError,
      profileLoading,
      profileError,
      isAccountant: profile?.role === 'accountant',
      signIn,
      signUp,
      signOut,
      requestReset,
      changePassword,
      updateName,
      reloadProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      authError,
      profileLoading,
      profileError,
      signIn,
      signUp,
      signOut,
      requestReset,
      changePassword,
      updateName,
      reloadProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
