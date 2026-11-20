#!/usr/bin/env node
// Crea (o actualiza) dos usuarios de demostración: empleado y contador.
// Requiere la clave service_role, que NUNCA debe exponerse al navegador.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match || match[2].startsWith('#')) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2')
    if (value && !value.includes('TU-PROYECTO')) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''

if (!url || !serviceKey) {
  console.error('Faltan variables. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de ejecutar el script.')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

const demoUsers = [
  {
    email: process.env.DEMO_EMPLOYEE_EMAIL ?? 'empleado@rivo.demo',
    password: process.env.DEMO_EMPLOYEE_PASSWORD ?? 'Empleado1234!',
    fullName: process.env.DEMO_EMPLOYEE_NAME ?? 'Ana Empleado',
    role: 'employee',
  },
  {
    email: process.env.DEMO_ACCOUNTANT_EMAIL ?? 'contador@rivo.demo',
    password: process.env.DEMO_ACCOUNTANT_PASSWORD ?? 'Contador1234!',
    fullName: process.env.DEMO_ACCOUNTANT_NAME ?? 'Carlos Contador',
    role: 'accountant',
  },
]

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body ? body.msg ?? body.message ?? body.error : body
    const error = new Error(message || `HTTP ${response.status}`)
    error.status = response.status
    error.body = body
    throw error
  }
  return body
}

async function findUser(email) {
  const result = await request(`/auth/v1/admin/users?page=1&per_page=1000`)
  const users = Array.isArray(result?.users) ? result.users : []
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureUser(config) {
  const existing = await findUser(config.email)
  let user

  if (existing) {
    user = await request(`/auth/v1/admin/users/${encodeURIComponent(existing.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: config.password,
        email_confirm: true,
        user_metadata: { full_name: config.fullName },
      }),
    })
  } else {
    user = await request('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: config.email,
        password: config.password,
        email_confirm: true,
        user_metadata: { full_name: config.fullName },
      }),
    })
  }

  // El trigger handle_new_user crea el perfil; el service_role puede ajustarlo
  // después gracias a la migración 20261120020000_admin_role_updates.sql.
  await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ full_name: config.fullName, role: config.role }),
  })

  return user.id
}

async function seedSamples(employeeId) {
  const today = new Date()
  const day = (offset) => {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    return date.toISOString().slice(0, 10)
  }
  const samples = [
    { merchant: 'Supermercado Nacional', total: 2480.5, category: 'alimentos', status: 'approved', days: 2, notes: 'Compra semanal de la oficina.' },
    { merchant: 'Gasolinera del Este', total: 1800, category: 'combustible', status: 'confirmed', days: 5, notes: 'Recarga del vehículo.' },
    { merchant: 'Papelería Central', total: 635, category: 'oficina', status: 'needs_review', days: 8, notes: 'Suministros; revisar el ITBIS.' },
  ]
  for (const sample of samples) {
    await request('/rest/v1/expenses', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: employeeId,
        merchant: sample.merchant,
        expense_date: day(sample.days),
        currency: 'DOP',
        total: sample.total,
        category: sample.category,
        status: sample.status,
        notes: sample.notes,
      }),
    })
  }
}

async function main() {
  console.log('Creando usuarios de demostración en', url)
  let employeeId = null
  for (const config of demoUsers) {
    const id = await ensureUser(config)
    if (config.role === 'employee') employeeId = id
    console.log(`  ✓ ${config.role.padEnd(10)} ${config.email}`)
  }

  if (process.argv.includes('--with-samples') && employeeId) {
    await seedSamples(employeeId)
    console.log('  ✓ 3 gastos de ejemplo agregados al empleado')
  }

  console.log('\nCredenciales de prueba (solo para demostración):')
  for (const config of demoUsers) {
    console.log(`  ${config.email}  /  ${config.password}`)
  }
  console.log('\nCámbialas antes de usar este proyecto en producción.')
}

main().catch((error) => {
  console.error('No se pudieron crear los usuarios de demostración:', error.message)
  if (error.status === 401 || error.status === 403) {
    console.error('Revisa SUPABASE_SERVICE_ROLE_KEY y que la migración SQL esté aplicada.')
  }
  process.exitCode = 1
})
