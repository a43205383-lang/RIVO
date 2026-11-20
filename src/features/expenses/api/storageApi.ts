import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

const EXPIRES_IN_SECONDS = 3600
const SAFETY_MS = 5 * 60 * 1000

interface CacheEntry {
  url: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function now() {
  return Date.now()
}

export async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const cached = cache.get(path)
  if (cached && cached.expiresAt > now()) return cached.url
  const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUrl(path, EXPIRES_IN_SECONDS)
  if (error || !data?.signedUrl) return null
  cache.set(path, { url: data.signedUrl, expiresAt: now() + EXPIRES_IN_SECONDS * 1000 - SAFETY_MS })
  return data.signedUrl
}

export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const result: Record<string, string> = {}
  const missing: string[] = []

  for (const path of unique) {
    const cached = cache.get(path)
    if (cached && cached.expiresAt > now()) result[path] = cached.url
    else missing.push(path)
  }

  for (let index = 0; index < missing.length; index += 50) {
    const batch = missing.slice(index, index + 50)
    const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUrls(batch, EXPIRES_IN_SECONDS)
    if (error || !data) continue
    for (const item of data) {
      if (!item.signedUrl || !item.path) continue
      result[item.path] = item.signedUrl
      cache.set(item.path, {
        url: item.signedUrl,
        expiresAt: now() + EXPIRES_IN_SECONDS * 1000 - SAFETY_MS,
      })
    }
  }

  return result
}

export function clearSignedUrlCache() {
  cache.clear()
}
