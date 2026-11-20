import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env } from '@/shared/lib/env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'rivo-auth',
  },
  global: {
    headers: {
      'X-Client-Info': 'rivo-pwa',
    },
  },
})

export function requireSupabase() {
  if (!env.configured) {
    throw new Error('Supabase no está configurado. Revisa tu archivo .env.')
  }
  return supabase
}
