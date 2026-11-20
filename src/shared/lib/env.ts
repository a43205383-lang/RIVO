const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
const rawMaxImages = Number.parseInt(import.meta.env.VITE_MAX_IMAGES_PER_EXPENSE ?? '5', 10)

function looksLikePlaceholder(value: string) {
  return (
    value.length === 0 ||
    value.includes('TU-PROYECTO') ||
    value.includes('tu-anon-key') ||
    value.includes('placeholder')
  )
}

const configured =
  !looksLikePlaceholder(rawUrl) &&
  !looksLikePlaceholder(rawKey) &&
  /^https?:\/\//i.test(rawUrl) &&
  (rawKey.startsWith('sb_publishable_') || rawKey.length > 20)

export const env = {
  supabaseUrl: configured ? rawUrl.replace(/\/+$/, '') : 'https://placeholder.supabase.co',
  supabaseAnonKey: configured ? rawKey : 'placeholder-anon-key',
  configured,
  storageBucket: 'receipts',
  maxImagesPerExpense: Number.isFinite(rawMaxImages) ? Math.min(Math.max(rawMaxImages, 1), 5) : 5,
  appName: 'Rivo',
} as const
