# RIVO

Escáner móvil de recibos con extracción asistida por IA y almacenamiento privado.

## Supabase

El esquema versionado está en `supabase/migrations/`. Si ya aplicaste una migración anterior, aplica las posteriores en orden: `20261120010000_align_frontend_contract.sql`, `20261120020000_admin_role_updates.sql` y `20261120030000_allow_pdf_receipts.sql`. En una instalación nueva, aplica las cuatro en orden.

### Aplicar la migración

1. Crea un proyecto en Supabase.
2. Si ya ejecutaste la migración inicial, abre las tres migraciones posteriores en SQL Editor y ejecútalas una vez cada una. Preservan las filas existentes, añaden las tablas, columnas, RPC y políticas que requiere el frontend, permiten asignar roles desde el panel administrativo y habilitan recibos PDF. Para una instalación nueva, aplica las cuatro migraciones en orden o inicializa Supabase CLI (`supabase init` y `supabase link`) y ejecuta `supabase db push`.
3. En **Authentication → Users**, crea o invita al usuario contador. Después de que se cree su perfil, asígnale el rol de contador desde SQL Editor:

   ```sql
   update public.profiles
   set role = 'accountant'
   where id = (select id from auth.users where email = 'contador@tu-dominio.com');
   ```

   El registro normal siempre crea perfiles `employee`; no se debe aceptar el rol desde datos enviados por el navegador.
4. Configura el cliente frontend con la URL del proyecto y la clave `anon`/publishable. Nunca expongas la clave `service_role` en el navegador.

### Modelo y permisos

- `profiles`: un perfil por usuario de Auth. El rol `accountant` se asigna administrativamente.
- `expenses`: datos del recibo, moneda DOP por defecto, categoría y estado (`draft`, `needs_review`, `confirmed`, `approved`, `rejected`). Incluye normalización del comercio y campos de aprobación.
- `expense_items` y `expense_images`: líneas opcionales y metadatos de imágenes, vinculados al gasto.
- `ai_usage`: registro de uso por usuario para limitar/proteger futuras llamadas de IA.
- `receipts`: bucket privado, máximo 5 MiB por archivo (las fotos se comprimen en el navegador a 1.5 MiB y los PDF se admiten hasta 5 MB). Usa objetos con la ruta `<user UUID>/<expense UUID>/<filename>` y URLs firmadas para mostrar imágenes.
- RLS permite al empleado ver y editar solo sus gastos sin revisar. Contabilidad puede ver todos y revisar. Las imágenes siguen el mismo alcance.

La revisión debe guardar `reviewed_by`, `reviewed_at` y el resultado aprobado/rechazado. Para evitar cambios del rol por usuarios, la promoción a contador se realiza desde el panel SQL administrativo.

## Configuración del cliente

Copia `.env.example` a `.env.local` y completa:

- `VITE_SUPABASE_URL`: URL del proyecto.
- `VITE_SUPABASE_ANON_KEY`: clave `anon`/publishable. Es pública; la seguridad vive en RLS.
- `VITE_MAX_IMAGES_PER_EXPENSE` (opcional, 1–5): límite de fotos por gasto.

Nunca pongas la clave `service_role` en una variable `VITE_*`: Vite la incluiría en el bundle.

## Edge Functions

Hay dos funciones en `supabase/functions/`:

- `extract-receipt`: valida la sesión, descarga las imágenes del bucket privado, llama a OpenAI Vision y devuelve los datos normalizados del recibo.
- `ask-expenses`: responde preguntas sobre los gastos visibles para el usuario (todo el equipo solo si es contador) y devuelve hasta 50 gastos relacionados.

Ambas registran cada llamada en `ai_usage` y aplican un límite diario configurable. Configura los secretos y despliega:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
# Opcionales: modelo y límites diarios
supabase secrets set OPENAI_VISION_MODEL=gpt-4o
supabase secrets set OPENAI_TEXT_MODEL=gpt-4o-mini
supabase secrets set AI_EXTRACT_DAILY_LIMIT=50
supabase secrets set AI_ASK_DAILY_LIMIT=30
supabase functions deploy extract-receipt
supabase functions deploy ask-expenses
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente. Las funciones exigen JWT válido (`verify_jwt = true` en `supabase/config.toml`) y comprueban además la sesión y la propiedad de las rutas de imagen.

## Usuarios de prueba

Tras aplicar las migraciones, crea los usuarios de demostración con:

```bash
SUPABASE_URL=https://TU-PROYECTO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
```

El script crea o actualiza:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Empleado | `empleado@rivo.demo` | `Empleado1234!` |
| Contador | `contador@rivo.demo` | `Contador1234!` |

Puedes cambiarlos con `DEMO_EMPLOYEE_EMAIL`, `DEMO_EMPLOYEE_PASSWORD`, `DEMO_ACCOUNTANT_EMAIL` y `DEMO_ACCOUNTANT_PASSWORD`. Añade `--with-samples` para crear tres gastos de ejemplo en la cuenta del empleado. **Cámbialas antes de usar el proyecto en producción.**

## Despliegue

El frontend es una PWA estática. `vercel.json` ya incluye los rewrites para SPA, cabeceras de seguridad y la configuración del service worker. En Vercel define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno del proyecto y ejecuta `npm run build` (directorio de salida `dist`). Para otro hosting, sirve `dist/` redirigiendo todas las rutas a `index.html`; `public/_redirects` cubre Netlify.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm run typecheck  # comprobación de tipos
npm run build      # tsc -b && vite build
```

Se recomienda Node 22.12+ (ver `.nvmrc`). El build se ha verificado con `npm run build`.
