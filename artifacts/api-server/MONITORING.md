# Monitoreo y salud (API Carper)

Guía breve para detectar y diagnosticar fallas en producción.

## Punto de salud

`GET /api/healthz`

- Responde `200` con `{ status: "ok", uptime, timestamp, database: { ok, latencyMs } }`
  cuando el servidor y la base de datos responden.
- Responde `503` con `status: "degraded"` si la base de datos no contesta.
- Útil para un monitor de uptime externo o para una verificación rápida tras un
  despliegue. No expone datos sensibles.

## Cómo revisar las fallas en producción (logs de despliegue)

Los errores quedan registrados de forma estructurada (pino) con contexto útil
(método, ruta, `requestId`) y **sin** secretos ni datos personales. En Replit:

1. Abre el panel de **Deployments** del proyecto.
2. Entra a la pestaña de **Logs** del deployment activo.
3. Filtra por nivel/patrón para encontrar problemas rápido:
   - `ERROR` — fallas no controladas (las captura el manejador central de
     errores con el mensaje `"Error no controlado en la API"`).
   - `Healthcheck: la base de datos no responde` — la base de datos está caída.
   - `Stripe:` — problemas de pago (creación de sesión, verificación, webhook,
     reembolsos pendientes de revisión manual).
   - `Admintotal:` — fallas de sincronización/envío de pedidos al ERP.
   - `Rate limit excedido` — un cliente/IP está siendo limitado por abuso.

> En el entorno del agente también se puede usar la herramienta de logs de
> despliegue para buscar estos mismos patrones (por ejemplo `ERROR`, `Stripe`,
> `Admintotal`).

## Anti-abuso (rate limiting)

- Tráfico general de `/api`: 300 req/min por IP.
- Endpoints sensibles de escritura (`/api/orders`, `/api/stripe/checkout`,
  `/api/stripe/verify`): 20 req/min por IP.
- Al exceder el límite se responde `429` con `Retry-After` y cabeceras
  `RateLimit-*`.
- Los webhooks verificados (Admintotal por token, Stripe por firma) están
  **exentos** del límite.

## Atomicidad

La creación de pedidos (efectivo/SPEI y el inicio del flujo de tarjeta) valida
existencia y stock e inserta el pedido dentro de una **transacción** con bloqueo
de filas de producto (`FOR UPDATE`): si algo falla, no queda un pedido a medias
y dos compras simultáneas del mismo artículo no pueden pasar ambas un control de
stock que solo una debería superar.
