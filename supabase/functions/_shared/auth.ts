import { config, serviceHeaders } from './env.ts'
import { HttpError } from './http.ts'

export async function requireUser(req: Request): Promise<{ id: string; token: string }> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    throw new HttpError('Tu sesión venció. Vuelve a iniciar sesión.', 'no_session', 401)
  }

  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey || config.serviceRoleKey,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new HttpError('Tu sesión no es válida. Vuelve a iniciar sesión.', 'invalid_session', 401)
  }

  const user = (await response.json().catch(() => null)) as { id?: string; aud?: string } | null
  if (!user?.id || user.aud === 'anon') {
    throw new HttpError('Tu sesión no es válida. Vuelve a iniciar sesión.', 'invalid_session', 401)
  }
  return { id: user.id, token }
}

export async function isAccountant(userId: string): Promise<boolean> {
  const url = `${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`
  const response = await fetch(url, { headers: serviceHeaders() })
  if (!response.ok) {
    console.error('[rivo] no se pudo consultar el rol', response.status)
    return false
  }
  const rows = (await response.json().catch(() => [])) as Array<{ role?: string }>
  return rows.some((row) => row.role === 'accountant')
}
