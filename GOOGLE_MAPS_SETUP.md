# Configuración de Google Maps - Rastreo de Técnico en Tiempo Real

## ¿Qué se implementó?

Se agregó un sistema de rastreo en tiempo real del técnico en el mapa que muestra:

- 📍 Ubicación en tiempo real del técnico
- 🎯 Ubicación del cliente
- 📏 Distancia entre técnico y cliente
- ⏱️ Tiempo estimado de llegada (ETA)
- 🛣️ Línea de ruta entre técnico y cliente
- 📞 Botón para llamar al técnico
- ▶️ Controles de pausa/reanudación y recentrado del mapa

## Componentes Implementados

### 1. Frontend
- **components/cliente/technician-tracking.tsx** - Componente de mapa interactivo
- **hooks/use-technician-location.ts** - Hook para el técnico que envía su ubicación
- Integrado en: **components/cliente/estado.tsx** (visible cuando estado = "en camino")

### 2. Backend
- **app/api/technician/location/[orderId]/route.ts** - Endpoints para guardar y obtener ubicación
  - POST: Guardar ubicación del técnico
  - GET: Obtener ubicación actual del técnico

### 3. Base de Datos
- **migrations/20260816_add_technician_locations.sql** - Tabla `technician_locations`

## Pasos para Habilitar

### 1. Obtener API Key de Google Maps

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Activa estas APIs:
   - Maps JavaScript API
   - Geocoding API
   - Distance Matrix API

4. Ve a **Credenciales** → **Crear Credenciales** → **Clave API**
5. Copia la API Key

### 2. Configurar Variables de Entorno

Agrega esto a tu `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

⚠️ Importante: Usar `NEXT_PUBLIC_` porque es necesario en el cliente

### 3. Ejecutar Migración de Base de Datos

```bash
node scripts/run-migration-technician-locations.js
```

O ejecutar manualmente el SQL:

```sql
CREATE TABLE IF NOT EXISTS technician_locations (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  technician_id TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technician_locations_order_id ON technician_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_technician_locations_technician_id ON technician_locations(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_locations_updated_at ON technician_locations(updated_at);
```

### 4. Reiniciar el Servidor

```bash
npm run dev
```

## Flujo de Funcionamiento

### Para el Cliente:
1. Cliente ve su orden con estado "en camino"
2. Se muestra un mapa interactivo en la sección de Estado
3. El mapa actualiza la ubicación del técnico cada 5 segundos
4. Puede ver la distancia y ETA en tiempo real
5. Puede llamar al técnico con un botón

### Para el Técnico:
1. Cuando acepta una orden y el estado cambia a "en camino"
2. La app del técnico automáticamente comienza a compartir su ubicación
3. Usa la API de Geolocalización del navegador con alta precisión
4. Envía la ubicación al servidor cada 5 segundos
5. El cliente ve su posición en tiempo real en el mapa

## Cálculo de Distancia y ETA

- **Distancia**: Usa la fórmula Haversine para calcular distancia en km
- **ETA**: Estimación basada en:
  - < 100m: "Ya llega"
  - < 1 km: ~5 km/h (tráfico urbano)
  - ≥ 1 km: ~10 km/h (promedio ciudad)

## Seguridad

- ✅ Solo técnicos autorizados pueden actualizar su ubicación
- ✅ Solo se guarda la ubicación más reciente (últimos 2 minutos)
- ✅ Los datos se limpian automáticamente si no se actualizan

## Costos de Google Maps

- **$200 USD de crédito GRATIS al mes**
- Sin costo si utilizas menos de $200 mensuales
- Requiere tarjeta de crédito pero no cobra automáticamente

## Troubleshooting

### El mapa no aparece
- Verifica que NEXT_PUBLIC_GOOGLE_MAPS_API_KEY está en .env.local
- Reinicia el servidor (npm run dev)
- Abre las DevTools y busca errores en la consola

### El técnico no comparte ubicación
- Verifica permisos de geolocalización en el navegador
- El técnico debe permitir acceso a la ubicación cuando se solicita
- Verifica que la orden tiene estado "en camino"

### Los endpoints no funcionan
- Verifica que la tabla `technician_locations` existe
- Ejecuta la migración: `node scripts/run-migration-technician-locations.js`
- Verifica logs en: /api/technician/location/[orderId]

## Características Futuras

Posibles mejoras:
- [ ] Historial de rutas completadas
- [ ] Notificaciones push cuando técnico está cerca
- [ ] Ruta optimizada con Google Directions
- [ ] Visualización de zona de cobertura
- [ ] Modo offline con sincronización posterior
