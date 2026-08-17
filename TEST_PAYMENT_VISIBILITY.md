# Test: Admin Visibility Based on Payment Status

## Objetivo
Verificar que las órdenes con pago online solo aparezcan en el admin cuando el pago haya sido confirmado por Mercado Pago.

## Cambios Realizados

### 1. Modificación de `crearOrden()` en `/app/actions/orden.ts`
- Agregado parámetro `metodoPago?: 'online' | 'terreno'`
- Cuando `metodoPago === 'online'` → orden se crea con estado **"pendiente_pago"**
- Cuando `metodoPago === 'terreno'` o no especificado → orden se crea con estado **"pendiente"**

### 2. Actualización de `/components/cliente/solicitar.tsx`
- Ahora pasa `metodoPago: pay` (que viene del selector de pago) a `crearOrden()`
- Las órdenes se crean con estado correcto según el método de pago

### 3. Modificación del webhook en `/app/api/payments/mercadopago/webhook/route.ts`
- Cuando MP confirma un pago → `mapMercadoPagoStatusToOrderStatus()` devuelve "pagada"
- Pero ahora se convierte a **"pendiente"** para que aparezca en el admin
- Esto es porque el admin filtra órdenes en estado "pendiente_pago" por defecto

### 4. Actualización del filtro en `/components/admin/admin-panel.tsx`
- El componente `Solicitudes` ahora filtra órdenes:
  - Excluye estado "pendiente_pago" cuando el filtro es 'all'
  - Esto evita que órdenes no pagadas aparezcan en el admin

## Flujo de Prueba

### Escenario 1: Orden con Pago Online (Mercado Pago)
1. Cliente crea solicitud y selecciona "Pago Online"
2. **Resultado en BD**: orden con estado = **"pendiente_pago"**
3. **Admin ve**: ❌ Orden NO aparece (filtrada por defecto)
4. Cliente completa pago en Mercado Pago
5. MP envía webhook a `/api/payments/mercadopago/webhook`
6. Webhook actualiza orden: estado = **"pendiente_pago"** → **"pendiente"**
7. **Admin ve**: ✅ Orden aparece en dashboard
8. Admin puede asignar técnico, crear cotización, etc.

### Escenario 2: Orden con Pago en Terreno
1. Cliente crea solicitud y selecciona "Pago al Técnico"
2. **Resultado en BD**: orden con estado = **"pendiente"**
3. **Admin ve**: ✅ Orden aparece inmediatamente en dashboard
4. Admin puede asignar técnico, crear cotización, etc.

## Validación

### Cambios de código comprobados:
- ✅ `crearOrden()` acepta parámetro `metodoPago`
- ✅ Estado inicial se asigna según método de pago
- ✅ Webhook convierte "pagada" a "pendiente"
- ✅ Admin filtra "pendiente_pago" del filtro por defecto

### Pendiente de prueba:
- Crear orden con pago online y verificar en DB que estado = "pendiente_pago"
- Simular pago en MP (o hacer pago real en sandbox)
- Verificar que webhook actualice estado a "pendiente"
- Verificar que orden aparezca en admin después del pago

## Comandos para Probar

```bash
# 1. Iniciar servidor en modo desarrollo
npm run dev

# 2. En otra terminal, opcional: monitorear requests
# Con curl o Postman, puedes hacer POST a /api/payments/mercadopago/webhook

# 3. Flujo manual:
# - Ir a /cliente/solicitar (como cliente autenticado)
# - Crear orden con pago online
# - Iniciar sesión como admin (o tecnico)
# - Verificar que orden NO aparezca en admin/
# - Volver como cliente, completar pago en MP (o simular webhook)
# - Recargar admin - orden debe aparecer
```

## Variables de Entorno Necesarias

```env
MERCADOPAGO_ACCESS_TOKEN=APP_xxxxxxxxxxxx  # Token de acceso
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=PUBLIC_KEY_xxxxx  # Clave pública
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Para desarrollo
```

## Notas

- El estado "pendiente_pago" solo aparece en órdenes que fueron creadas con `metodoPago='online'`
- El estado "pendiente" ahora significa "orden pagada o con pago en terreno, lista para que admin asigne técnico"
- El webhook es crítico: sin él, las órdenes pagadas nunca aparecerán en el admin
- Para testing local, asegúrate de registrar la URL del webhook en MP Dashboard:
  - URL: `https://zerocodex.onrender.com/api/payments/mercadopago/webhook` (producción)
  - O usar ngrok para exponer localhost en desarrollo
