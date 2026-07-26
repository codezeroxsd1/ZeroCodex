# Code Zero

## Deploy en Render usando Neon

### 1) Requisitos

- Repositorio GitHub conectado a Render
- Branch `main` o el branch que uses
- `render.yaml` en la raíz del proyecto
- Variable de entorno `DATABASE_URL` apuntando a Neon

### 2) Archivos importantes

- `render.yaml` — define el servicio web en Render
- `.env.local.example` — ejemplo local de la variable `DATABASE_URL`
- `lib/db/index.ts` — lee `process.env.DATABASE_URL`
- `lib/auth.ts` — también usa `process.env.DATABASE_URL`
- `scripts/run-migration.js` — usa `process.env.DATABASE_URL` si existe

### 3) Configuración de Render

En Render, crea un servicio:

1. Selecciona **Web Services** → **New Web Service**.
2. Conecta tu repositorio GitHub y elige el branch `main`.
3. Render detectará `render.yaml` en la raíz y aplicará la configuración automáticamente.

Si no usa `render.yaml`, selecciona manualmente:

- Environment: `Node`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Root directory: `./`

Agrega las siguientes variables de entorno en la sección Environment:

- `NODE_ENV` = `production`
- `DATABASE_URL` = `postgresql://neondb_owner:npg_TJ35AgBesNKm@ep-hidden-salad-avjeuokn-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

### 4) Migraciones en Neon

Si necesitas ejecutar la migración en el entorno local antes de desplegar:

```cmd
cd /d "d:\DESCARGAS HDD\code zero"
npm run migrate:orden
```

Si quieres correr migración dentro de Render, usa un comando parecido a:

```bash
npm run migrate:orden
```

### 5) Notas

- El proyecto usa PostgreSQL estándar con `pg` y `drizzle-orm`.
- `DATABASE_URL` controla toda la conexión a la base de datos.
- Si quieres, puedo agregar un `render.yaml` final y un comando de deploy directo.
