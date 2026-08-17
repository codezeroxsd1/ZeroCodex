# Configuración de Mercado Pago

## 1. Obtener Credenciales

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel)
2. Inicia sesión con tu cuenta de Mercado Pago
3. Selecciona la aplicación o crea una nueva
4. En la sección "Credenciales", obtén:
   - **Access Token** (producción y prueba)
   - **Public Key** (opcional, solo si usas SDK del cliente)

## 2. Configurar Variables de Entorno

Añade las siguientes variables a tu archivo `.env.local`:

```env
# Mercado Pago - Access Token
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_aqui

# Opcional: Public Key para componentes del cliente
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu_public_key_aqui

# URL base de la aplicación (para webhooks)
NEXT_PUBLIC_APP_URL=https://tudominio.com
```

## 3. Configurar Webhook

Para que Mercado Pago notifique los pagos realizados:

1. Ve a [Mercado Pago Developers - Notificaciones](https://www.mercadopago.com.ar/developers/panel/notifications)
2. En "IPN/Webhook", añade:
   - **URL**: `https://tudominio.com/api/payments/mercadopago/webhook`
   - **Eventos**: Selecciona "payment"

## 4. Flujo de Pago

### Cliente
1. Cliente ve una cotización en la aplicación
2. Hace clic en "Ir a pago"
3. Se envía petición POST a `/api/payments/mercadopago` con datos:
   ```json
   {
     "orderId": 123,
     "amount": 50000,
     "payerEmail": "cliente@example.com",
     "payerName": "Nombre Cliente",
     "description": "Descripción del servicio",
     "origin": "https://tudominio.com"
   }
   ```

### Servidor
1. Endpoint `/api/payments/mercadopago` valida los datos
2. Crea una preferencia de pago con Mercado Pago
3. Retorna `initPoint` (URL de checkout)
4. Cliente es redirigido a Mercado Pago

### Pago Exitoso
1. Cliente completa el pago en Mercado Pago
2. Mercado Pago envía notificación al webhook
3. Webhook actualiza el estado de la orden a "pagada"
4. Cliente es redirigido de vuelta a la app

## 5. Estados de Pago

| Estado MP | Estado Orden |
|-----------|--------------|
| approved | pagada |
| authorized | pagada |
| pending | pendiente_pago |
| in_process | pendiente_pago |
| in_mediation | pendiente_pago |
| rejected | aceptada |
| cancelled | aceptada |
| charged_back | aceptada |

## 6. Pruebas

Para probar sin dinero real:

1. Usa el **Access Token de prueba** de Mercado Pago
2. Usa tarjetas de prueba:
   - **VISA**: 4111 1111 1111 1111
   - **Mastercard**: 5555 5555 5555 4444
   - **Otros**: Ver [Mercado Pago Test Cards](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/additional-content/your-integrations/test-cards)

## 7. Moneda y Formato

- **Moneda**: CLP (Pesos Chilenos)
- **Formato de monto**: Números enteros, sin decimales
- Ej: 50000 CLP = $50.000 CLP

## 8. Troubleshooting

### "MERCADOPAGO_ACCESS_TOKEN not configured"
- Verifica que la variable esté en `.env.local`
- Reinicia el servidor de desarrollo

### Webhook no recibe notificaciones
- Verifica que la URL sea pública y accesible
- Comprueba logs en Mercado Pago Dashboard
- Asegúrate de usar HTTPS en producción

### Pago no actualiza en la app
- Revisa los logs del servidor
- Verifica que la orden exista en la BD
- Comprueba que el webhook esté configurado correctamente

## Archivos Relacionados

- `/lib/mercadopago-config.ts` - Configuración
- `/lib/mercadopago-server.ts` - Funciones de servidor
- `/app/api/payments/mercadopago/route.ts` - Endpoint de checkout
- `/app/api/payments/mercadopago/webhook/route.ts` - Webhook
- `/components/cliente/quote-preview.tsx` - UI del cliente
