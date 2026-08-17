# ⚡ Integración de Mercado Pago - Guía Rápida

## 🎯 Resumen

Tu aplicación ya está **100% lista para recibir pagos**. Solo necesitas configurar tus credenciales de Mercado Pago.

## 📋 Checklist de Configuración

### ✅ 1. Obtener Credenciales (5 minutos)
```
1. Ve a: https://www.mercadopago.com.ar/developers/panel
2. Inicia sesión
3. Copia el "Access Token" de PRODUCCIÓN
4. Guarda en un lugar seguro
```

### ✅ 2. Añadir Variables de Entorno
```bash
# .env.local
MERCADOPAGO_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
NEXT_PUBLIC_APP_URL=https://tudominio.com
```

### ✅ 3. Reiniciar Servidor
```bash
npm run dev
```

### ✅ 4. Configurar Webhook (2 minutos)
```
1. Ve a: https://www.mercadopago.com.ar/developers/panel/notifications
2. Añade URL: https://tudominio.com/api/payments/mercadopago/webhook
3. Selecciona: Eventos de Pago (payment)
4. Guardar
```

## 🧪 Probar en Desarrollo

```bash
# Ver estado de configuración
curl http://localhost:3000/api/payments/mercadopago/status

# Crear checkout de prueba
curl -X POST http://localhost:3000/api/payments/mercadopago/status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 12345,
    "amount": 50000,
    "payerEmail": "cliente@example.com",
    "payerName": "Cliente Test"
  }'
```

### Tarjetas de Prueba
- **VISA**: 4111 1111 1111 1111 (Exp: 11/25, CVV: 123)
- **Mastercard**: 5555 5555 5555 4444 (Exp: 11/25, CVV: 123)
- **Documentos**: Cualquier número (ej: 12345678)

## 📁 Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `lib/mercadopago-config.ts` | Configuración centralizada |
| `lib/mercadopago-server.ts` | Lógica de servidor |
| `app/api/payments/mercadopago/route.ts` | Crear checkouts |
| `app/api/payments/mercadopago/webhook/route.ts` | Recibir pagos |
| `components/mercadopago-button.tsx` | Botón reutilizable |
| `MERCADOPAGO_SETUP.md` | Documentación completa |

## 🔄 Flujo de Pago

```
Cliente                    App                  Mercado Pago
   │                        │                         │
   ├─ Solicita pago ───────→│                         │
   │                        ├─ POST /checkout ───────→│
   │                        │←─ initPoint ────────────│
   │←─ Redirige a MP ───────│                         │
   │                        │                         │
   │                  Completa pago                   │
   │                        │                         │
   │                        │←─ Webhook ──────────────│
   │                        │                         │
   │←─ Redirige al app ─────│                         │
   │                        │                         │
```

## 🐛 Troubleshooting

**Error: "MERCADOPAGO_ACCESS_TOKEN not configured"**
- ✅ Verifica `.env.local`
- ✅ Reinicia servidor (`npm run dev`)

**Webhook no recibe notificaciones**
- ✅ Verifica que la URL sea pública y HTTPS
- ✅ Revisa logs en MP Dashboard
- ✅ Comprueba que esté configurado en MP

**Pago no actualiza en la app**
- ✅ Revisa logs del servidor
- ✅ Verifica que la orden exista en BD
- ✅ Comprueba estado en webhook

## 📞 Soporte

- Docs Mercado Pago: https://www.mercadopago.com.ar/developers/
- Dashboard: https://www.mercadopago.com.ar/developers/panel
- Test Cards: https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/additional-content/your-integrations/test-cards

---

**Estado**: ✅ Listo para producción
**Última actualización**: 2026-08-16
