# RIVO

Escáner móvil de recibos con extracción asistida por IA y almacenamiento privado.

## Supabase

Para un proyecto nuevo, ejecuta el esquema consolidado `supabase/schema.sql` una vez en Supabase SQL Editor. Si ya aplicaste `20261120000000_initial_schema.sql` y no quieres recrear el proyecto, ejecuta en orden las migraciones siguientes: `20261120010000_align_frontend_contract.sql`, `20261120020000_admin_role_updates.sql` y `20261120030000_allow_pdf_receipts.sql`.

### Aplicar la migración

1. Crea un proyecto en Supabase.
2. En un proyecto vacío, abre `supabase/schema.sql` en SQL Editor y ejecútalo una vez. Si el proyecto ya tiene la primera migración, no ejecutes el esquema consolidado: aplica las tres migraciones de actualización en el orden indicado arriba. También puedes usar Supabase CLI con los archivos de migración (`supabase init`, `supabase link`, `supabase db push`).
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

- `extract-receipt`: valida la sesión, descarga las imágenes del bucket privado, llama a Gemini Vision y devuelve los datos normalizados del recibo.
- `ask-expenses`: responde preguntas sobre los gastos visibles para el usuario (todo el equipo solo si es contador) con Gemini y devuelve hasta 50 gastos relacionados.

Ambas registran cada llamada en `ai_usage` y aplican un límite diario configurable. Configura los secretos y despliega:

```bash
supabase secrets set GEMINI_API_KEY=...
# Opcionales: modelos y límites diarios
supabase secrets set GEMINI_VISION_MODEL=gemini-3.5-flash
supabase secrets set GEMINI_TEXT_MODEL=gemini-3.5-flash
supabase secrets set AI_EXTRACT_DAILY_LIMIT=50
supabase secrets set AI_ASK_DAILY_LIMIT=30
supabase functions deploy extract-receipt
supabase functions deploy ask-expenses
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente. Las funciones exigen JWT válido (`verify_jwt = true` en `supabase/config.toml`) y comprueban además la sesión y la propiedad de las rutas de imagen.

## Uso móvil y sin conexión

- La interfaz es responsive desde 320 px; en dispositivos con pantalla táctil los controles tienen un área mínima de 44 × 44 px.
- `public/manifest.webmanifest` configura el nombre, iconos de 192 y 512 px y modo `standalone`. El service worker se registra solo en producción. Hay que abrir Rivo con internet una vez antes de poder cargar el shell offline e instalarla desde el navegador.
- El service worker guarda el shell, los recursos visitados y hasta 80 respuestas de imágenes firmadas de Storage. Las llamadas a Auth, REST y Edge Functions requieren red.
- La lista conserva hasta 200 gastos por usuario en `localStorage`; muestra esa copia con aviso si falla la red. El detalle solo funciona sin conexión si ese gasto ya se guardó en caché.
- Las capturas offline se guardan en IndexedDB, hasta 10 recibos. Se procesan cuando vuelve la conexión mientras la app está abierta o al volver a abrirla. No hay Background Sync que procese capturas con la app cerrada.
- Las pantallas principales incluyen estados de carga, error y vacío; el límite global de errores de React muestra una opción para recargar.

## Límites actuales de IA

- El cliente reduce cada foto a un máximo de 1600 px por lado y 1.5 MiB; la extracción acepta hasta 5 imágenes por llamada. Los PDF se admiten como adjuntos manuales hasta 5 MiB, pero no se envían a Gemini.
- Los límites diarios predeterminados son 50 extracciones y 30 consultas por usuario. Actualmente la función consulta el uso y luego inserta el registro en pasos separados: llamadas simultáneas pueden rebasar el cupo y no hay límite por minuto. No se debe considerar todavía una protección estricta de costos contra ráfagas.
- `ask-expenses` consulta los gastos dentro del alcance del usuario (o de contabilidad) y envía como máximo los 150 más recientes a Gemini. La función filtra los IDs de gastos que devuelve el modelo, pero el texto de la respuesta —incluidos importes calculados— no se verifica contra una agregación determinista de la base de datos. Para respuestas numéricas exactas, este requisito aún necesita endurecerse.
- La lista de preguntas no puede representar gastos anteriores a los 150 registros recibidos en esa petición. Si el usuario pregunta por un período o dato fuera de ese conjunto, el modelo puede carecer de contexto suficiente.

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

Se requiere Node 22.12+ (ver `.nvmrc`); Vite avisa si se compila con una versión inferior. `npm run build` ejecuta el chequeo TypeScript y genera los archivos de producción.
