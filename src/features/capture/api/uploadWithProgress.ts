import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export async function uploadWithProgress({
  path,
  blob,
  accessToken,
  onProgress,
}: {
  path: string
  blob: Blob
  accessToken: string
  onProgress?: (loaded: number) => void
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.supabaseUrl}/storage/v1/object/${env.storageBucket}/${encodePath(path)}`)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('apikey', env.supabaseAnonKey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('cache-control', '3600')
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
    xhr.timeout = 120_000

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(blob.size)
        resolve()
        return
      }
      let message = `No pudimos subir la imagen (HTTP ${xhr.status}).`
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        if (body.message || body.error) message = body.message ?? body.error ?? message
      } catch {
        // ignore
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('La subida falló por un problema de red. Revisa tu conexión.'))
    xhr.ontimeout = () => reject(new Error('La subida tardó demasiado. Intenta de nuevo.'))
    xhr.onabort = () => reject(new Error('La subida fue cancelada.'))
    xhr.send(blob)
  })
}

export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Tu sesión venció. Vuelve a iniciar sesión.')
  return session.access_token
}
