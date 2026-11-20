import { supabase } from '@/shared/lib/supabase'
import type { ProfileRow } from '@/shared/types/database.types'

export interface AuthResult {
  error: string | null
  needsEmailConfirmation?: boolean
}

export async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function fetchProfileWithRetry(userId: string, attempts = 3): Promise<ProfileRow> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchProfile(userId)
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 450 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return { error: error ? translateAuthError(error.message) : null }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: { full_name: fullName.trim() },
    },
  })
  if (error) return { error: translateAuthError(error.message) }
  return { error: null, needsEmailConfirmation: !data.session }
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut()
  return { error: error ? translateAuthError(error.message) : null }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  return { error: error ? translateAuthError(error.message) : null }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error ? translateAuthError(error.message) : null }
}

export async function updateFullName(userId: string, fullName: string): Promise<AuthResult> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
    .eq('id', userId)
  return { error: error ? translateAuthError(error.message) : null }
}

export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (normalized.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.'
  if (normalized.includes('user already registered')) return 'Ya existe una cuenta con ese correo.'
  if (normalized.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (normalized.includes('rate limit') || normalized.includes('too many requests'))
    return 'Demasiados intentos. Espera un momento e intenta de nuevo.'
  if (normalized.includes('email address') && normalized.includes('invalid')) return 'El correo no es válido.'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'No hay conexión con Supabase. Revisa tu internet.'
  return message
}
