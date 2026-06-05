# Monitoreo y salud (API Carper)

Guía breve para detectar y diagnosticar fallas en producción.

## Punto de salud

`GET /api/healthz`

- Es un chequeo de **liveness**: responde `200` siempre que el proceso esté
  sirviendo, con `{ status, uptime, timestamp, database: { ok, latencyMs } }`.
- `status: "ok"` cuando la base de datos responde; `status: "degraded"` (sigue
  siendo `200`) si la base de datos no contesta dentro del tiempo límite. El
  ping a la base está acotado (2.5 s) y nunca cuelga ni lanza error.
- **No** devuelve `503` ante un fallo transitorio de la base: así un arranque en
  frío (autoscale despertando el Postgres suspendido) no marca una caída falsa.
  Las fallas reales de base de datos sí aparecen como `5xx` en los endpoints de
  datos. Cuando `database.ok` es `false` se registra una advertencia.
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
   - `Healthcheck: la base de datos no respondió a tiempo` — la base de datos
     no contestó dentro del límite (servicio degradado pero vivo).
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
