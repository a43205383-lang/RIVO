import type { PreparedCapture, QueuedCapture } from '@/features/capture/types'

const DB_NAME = 'rivo-offline'
const DB_VERSION = 1
const STORE = 'captures'
const MAX_QUEUED = 10

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Este navegador no permite guardar recibos sin conexión.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No pudimos abrir el almacenamiento local.'))
    request.onblocked = () => reject(new Error('Cierra otras pestañas de Rivo y vuelve a intentar.'))
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Error de almacenamiento local.'))
  })
}

export function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent('rivo:queue-changed'))
}

export async function enqueueCapture(userId: string, files: PreparedCapture[]): Promise<QueuedCapture> {
  const db = await openDb()
  const existing = await listQueuedCaptures(userId)
  if (existing.length >= MAX_QUEUED) {
    throw new Error(`La cola admite hasta ${MAX_QUEUED} recibos. Conéctate para procesarlos.`)
  }
  const item: QueuedCapture = {
    id: crypto.randomUUID(),
    userId,
    createdAt: Date.now(),
    files,
  }
  const transaction = db.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).put(item)
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No pudimos guardar el recibo en el dispositivo.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('No pudimos guardar el recibo en el dispositivo.'))
  })
  notifyQueueChanged()
  return item
}

export async function listQueuedCaptures(userId: string): Promise<QueuedCapture[]> {
  const db = await openDb()
  const transaction = db.transaction(STORE, 'readonly')
  const index = transaction.objectStore(STORE).index('userId')
  const result = await requestToPromise(index.getAll(IDBKeyRange.only(userId)))
  return (result as QueuedCapture[]).sort((a, b) => a.createdAt - b.createdAt)
}

export async function deleteQueuedCapture(id: string): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).delete(id)
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No pudimos actualizar la cola.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('No pudimos actualizar la cola.'))
  })
  notifyQueueChanged()
}

export async function countQueuedCaptures(userId: string): Promise<number> {
  const db = await openDb()
  const transaction = db.transaction(STORE, 'readonly')
  const index = transaction.objectStore(STORE).index('userId')
  return requestToPromise(index.count(IDBKeyRange.only(userId)))
}
