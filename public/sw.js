/*
  Rivo service worker.
  Estrategia:
  - App shell: precache + network-first en navegación (fallback offline).
  - Assets propios: stale-while-revalidate.
  - Imágenes firmadas de Supabase Storage: cache-first con revalidación en segundo plano.
  - API/Auth/Edge Functions: siempre red (nunca se cachean datos sensibles).
*/
const VERSION = 'rivo-v1.0.0'
const CORE_CACHE = `${VERSION}-core`
const ASSET_CACHE = `${VERSION}-assets`
const IMAGE_CACHE = `${VERSION}-images`
const MAX_IMAGES = 80

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isSupabaseStorage(url) {
  return url.pathname.includes('/storage/v1/object/sign/') || url.pathname.includes('/storage/v1/object/public/')
}

function isSupabaseRequest(url) {
  return url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CORE_CACHE)
      cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      new Response('<h1>Rivo está sin conexión</h1><p>Abre la app una vez con internet para poder usarla offline.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    )
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return cached || (await network) || Response.error()
}

async function imageCacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone())
      })
      .catch(() => undefined)
      .finally(() => trimCache(IMAGE_CACHE, MAX_IMAGES))
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      await trimCache(IMAGE_CACHE, MAX_IMAGES)
    }
    return response
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (url.origin !== self.location.origin && isSupabaseRequest(url)) {
    if (isSupabaseStorage(url)) {
      event.respondWith(imageCacheFirst(request))
    }
    // REST, Auth y Edge Functions: red únicamente.
    return
  }

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js') return
    const destination = request.destination
    if (['script', 'style', 'image', 'font', 'manifest'].includes(destination)) {
      event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
    }
  }
})
