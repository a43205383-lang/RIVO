interface PostgrestLikeError {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export function errorMessage(error: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'No pudimos conectar con el servidor. Revisa tu conexión.'
    }
    return error.message || fallback
  }
  const record = error as PostgrestLikeError
  if (record.code === '42501') return 'No tienes permiso para hacer esta acción.'
  if (record.code === '23505') return 'Ya existe un registro con esos datos.'
  if (record.code === 'PGRST116') return 'No encontramos ese registro.'
  if (record.code === 'PGRST301' || record.message?.includes('JWT')) {
    return 'Tu sesión venció. Vuelve a iniciar sesión.'
  }
  if (record.message?.toLowerCase().includes('failed to fetch')) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }
  return record.message || record.details || fallback
}
