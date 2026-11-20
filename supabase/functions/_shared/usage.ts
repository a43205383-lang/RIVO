import { config, serviceHeaders } from './env.ts'
import { HttpError } from './http.ts'

export type UsageKind = 'extract' | 'ask'

export interface UsageTicket {
  remaining: number | null
  finish: (status: 'succeeded' | 'failed') => Promise<void>
}

function limitFor(kind: UsageKind): number {
  return kind === 'extract' ? config.extractDailyLimit : config.askDailyLimit
}

function startOfUtcDay(): string {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString()
}

async function countToday(userId: string, kind: UsageKind): Promise<number> {
  const since = encodeURIComponent(startOfUtcDay())
  const url =
    `${config.supabaseUrl}/rest/v1/ai_usage?select=id` +
    `&user_id=eq.${encodeURIComponent(userId)}&kind=eq.${kind}&created_at=gte.${since}`
  const response = await fetch(url, { headers: serviceHeaders() })
  if (!response.ok) throw new HttpError('No pudimos verificar tu cuota de IA.', 'quota_check', 503)
  const rows = await response.json().catch(() => [])
  return Array.isArray(rows) ? rows.length : 0
}

async function insertUsage(userId: string, kind: UsageKind): Promise<number> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/ai_usage`, {
    method: 'POST',
    headers: {
      ...serviceHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, kind, status: 'started' }),
  })
  if (!response.ok) {
    console.error('[rivo] no se pudo registrar el uso de IA', response.status)
    return 0
  }
  const rows = (await response.json().catch(() => [])) as Array<{ id?: number }>
  return typeof rows[0]?.id === 'number' ? rows[0].id : 0
}

/** Cuenta el uso del día, aplica el límite y devuelve un ticket para marcar el resultado. */
export async function startUsage(userId: string, kind: UsageKind): Promise<UsageTicket> {
  const limit = limitFor(kind)
  const used = await countToday(userId, kind)
  if (limit > 0 && used >= limit) {
    const label = kind === 'extract' ? 'análisis de recibos' : 'consultas'
    throw new HttpError(`Alcanzaste el límite diario de ${label}. Vuelve mañana.`, 'quota_exceeded', 429)
  }

  const id = await insertUsage(userId, kind)
  const remaining = limit > 0 ? Math.max(0, limit - used - 1) : null

  return {
    remaining,
    finish: async (status) => {
      if (!id) return
      await fetch(`${config.supabaseUrl}/rest/v1/ai_usage?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status }),
      }).catch((error) => console.error('[rivo] no se pudo actualizar el uso de IA', error))
    },
  }
}
