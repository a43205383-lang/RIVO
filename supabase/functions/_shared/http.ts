export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export class HttpError extends Error {
  status: number
  code: string

  constructor(message: string, code = 'server_error', status = 500) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.status = status
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function failure(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, error.status)
  }
  console.error('[rivo] unexpected error', error)
  return json({ error: 'El servicio tuvo un problema inesperado.', code: 'internal_error' }, 500)
}

export function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => {
    throw new HttpError('El cuerpo de la petición no es JSON válido.', 'invalid_body', 400)
  })
}
