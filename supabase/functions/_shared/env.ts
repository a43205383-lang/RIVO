function numberFrom(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const config = {
  supabaseUrl: (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, ''),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  geminiApiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
  visionModel: Deno.env.get('GEMINI_VISION_MODEL') ?? 'gemini-3.5-flash',
  textModel: Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-3.5-flash',
  extractDailyLimit: numberFrom('AI_EXTRACT_DAILY_LIMIT', 50),
  askDailyLimit: numberFrom('AI_ASK_DAILY_LIMIT', 30),
} as const

export function serviceHeaders(): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  }
}

export function assertServerConfig(): void {
  if (!config.supabaseUrl) throw new Error('Falta SUPABASE_URL')
  if (!config.serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY')
}
