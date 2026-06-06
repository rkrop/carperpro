# Auditoria Carper

Fecha de esta pasada: 2026-06-06

## Resumen ejecutivo

Carper es una plataforma publica de autopartes con tres superficies principales:

- `artifacts/api-server`: API Express 5 con PostgreSQL/Drizzle, sincronizacion AdminTotal, Stripe, Twilio, Clerk, push notifications e IA.
- `artifacts/carper`: app Expo para cliente final.
- `artifacts/tienda`: storefront Vite para catalogo publico/SEO.

La vision tecnica que conviene proteger es clara: el catalogo viene del ERP, la app y la tienda deben vender solo piezas realmente publicables, los pagos deben confirmarse de forma autoritativa, y la IA debe ayudar sin inventar inventario ni compatibilidades.

En esta pasada se corrigieron riesgos de exposicion publica, abuso de endpoints y consistencia de checkout. Tambien quedan hallazgos estructurales para la siguiente fase, principalmente integridad referencial en base de datos, pruebas de integracion y limpieza del workflow local.

## Cambios aplicados

| Area | Estado | Cambio |
| --- | --- | --- |
| CORS | Corregido | `artifacts/api-server/src/app.ts:38` crea allowlist de dominios first-party; `app.ts:68` configura CORS con credenciales sin abrir cualquier origen. |
| Admin interno | Corregido | `artifacts/api-server/src/routes/admin.ts:43` permite sin token solo en localhost; previews publicos y produccion requieren `Api-key`. |
| Ordenes cash/SPEI | Corregido | `artifacts/api-server/src/routes/orders.ts:21` limita lineas; `orders.ts:163` rechaza productos `sin_precio` o precio efectivo no vendible. |
| Stripe checkout | Corregido | `artifacts/api-server/src/routes/stripe.ts:20` limita input; `artifacts/api-server/src/lib/stripe/service.ts:185` valida vendibilidad dentro del servicio, no solo en la ruta. |
| Catalogo publico | Corregido | `artifacts/api-server/src/routes/catalog.ts:34` limita query, paginacion y disponibilidad para evitar solicitudes gigantes. |
| Favoritos | Mitigado | `artifacts/api-server/src/routes/account.ts:25` limita tamano de snapshot y cantidad de favoritos sincronizados. |
| Sitemap | Corregido | `artifacts/api-server/src/routes/sitemap.ts:47` prefiere `PUBLIC_SITE_URL`/dominios Replit y evita depender de `Host` arbitrario en produccion. |
| Logs | Corregido | `artifacts/api-server/src/lib/logger.ts:7` amplia redaccion de tokens, telefono, guest token y direccion; `webhooks.ts:137` deja de registrar lotes crudos de precio/stock. |

## Hallazgos principales

| Severidad | Hallazgo | Estado recomendado |
| --- | --- | --- |
| Alta | CORS aceptaba cualquier origen con `credentials: true`, permitiendo que otro sitio llamara la API con credenciales del usuario. | Corregido en esta pasada. |
| Alta | Rutas `/api/admin/*` quedaban abiertas en ambientes no-produccion, incluyendo previews remotos potencialmente publicos. | Corregido en esta pasada. |
| Alta | Checkout podia aceptar productos ocultos/sin precio si alguien llamaba la API directo. | Corregido en ordenes y Stripe. |
| Media | `push_tokens.user_id`, `back_in_stock_subs.user_id` y `back_in_stock_subs.product_id` no tienen FK. El codigo limpia algunos casos, pero la DB permite orfanos. | Agregar migracion con FK/cascade o documentar retencion intencional. |
| Media | Favoritos siguen guardando snapshot enviado por cliente. Ahora tiene limites, pero la fuente ideal deberia ser el servidor consultando producto por ID. | Segunda fase: guardar snapshot server-side o validar shape completo. |
| Media | El workspace completo tiene fallos previos de typecheck en `tienda`/`mockup-sandbox` por tipos React duplicados/componentes UI. | Limpiar dependencias/tipos para recuperar `pnpm run typecheck`. |
| Media | Build local en Mac falla por overrides de paquetes nativos (`esbuild`, `lightningcss`, etc.) optimizados para Replit/Linux. | Mantener para deploy Replit, pero documentar alternativa local o condicionar por plataforma/CI. |
| Baja | `pnpm run typecheck` puede disparar verificacion de dependencias y chocar con el guard `preinstall` cuando falta `npm_config_user_agent`. | Ajustar guard o documentar comandos directos `tsc`. |

## Controles que ya estaban bien

- Webhook Stripe usa raw body antes de `express.json`, necesario para verificar firma.
- `trust proxy` esta limitado a un salto.
- Rate limit global usa PostgreSQL, con fallback local si la DB falla.
- OTP por telefono falla cerrado si no hay DB disponible.
- Sesiones telefonicas guardan hash SHA-256, no token plano.
- `requireAuth` unifica Clerk y sesiones telefonicas.
- Ordenes recomputan precio del lado servidor y usan transaccion con bloqueo de filas.
- `/api/stripe/verify` autoriza al usuario o exige `guestToken`.
- Webhooks AdminTotal comparan token con `timingSafeEqual`.
- IA del asistente se apoya en busqueda de catalogo, no en inventario inventado.

## Verificacion ejecutada

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso. |
| `./node_modules/.bin/tsc -p artifacts/api-server/tsconfig.json --noEmit` | Paso. |
| `./node_modules/.bin/tsc --build` | Paso. |

No se uso el build local del API como criterio final porque este workspace excluye paquetes nativos de Mac en `pnpm-workspace.yaml` para favorecer Replit/Linux.

## Proximo plan recomendado

1. Revisar este diff y hacer commit/push como parche de seguridad de API.
2. Configurar/confirmar en Replit: `ADMINTOTAL_WEBHOOK_TOKEN` y `PUBLIC_SITE_URL`.
3. Crear migracion de integridad referencial para push/restock y limpiar orfanos existentes.
4. Agregar pruebas de integracion para CORS, admin auth, cash/SPEI, Stripe checkout y catalog caps.
5. Recuperar `pnpm run typecheck` completo arreglando los errores existentes en `tienda` y `mockup-sandbox`.
6. Ejecutar smoke test en Replit: catalogo, checkout, Stripe verify, webhook AdminTotal y sitemap.
