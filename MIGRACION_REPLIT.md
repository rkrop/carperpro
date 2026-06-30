# Migración fuera de Replit

Este repo ya no debe depender de conectores, dominios ni variables `REPLIT_*` para producción. La ruta recomendada es Render para `artifacts/api-server` y Neon para Postgres.

## Variables principales

- `DATABASE_URL`: conexión Postgres externa, por ejemplo Neon con SSL.
- `PUBLIC_API_URL`: URL pública del backend, por ejemplo `https://api.carperautopartes.com`.
- `PUBLIC_SITE_URL`: URL pública de la tienda, por ejemplo `https://carperautopartes.com`.
- `ALLOWED_ORIGINS`: lista separada por comas de orígenes permitidos por CORS.
- `EXPO_PUBLIC_API_URL`: URL pública del backend compilada dentro de Expo.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`: credenciales directas de Stripe.
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PROXY_URL`: Clerk sin dominio Replit.
- `ADMINTOTAL_*`, `TWILIO_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`: secretos del host, nunca versionados.

## Render

El archivo `render.yaml` define un servicio web `carper-api` con:

- Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Health check: `/api/healthz`

Configura los secretos en Render y apunta `PUBLIC_API_URL` al dominio final del servicio.

## Neon

Crea una base Postgres, copia su connection string en `DATABASE_URL` y conserva backups automáticos. El backend verifica la conexión en `/api/healthz`.

## Stripe

Configura manualmente en Stripe un webhook hacia:

`$PUBLIC_API_URL/api/stripe/webhook`

Eventos mínimos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Copia el signing secret en `STRIPE_WEBHOOK_SECRET`.

## Validación

Antes de apagar Replit:

1. `pnpm run typecheck`
2. `pnpm --filter @workspace/api-server run test`
3. `pnpm --filter @workspace/api-server run build`
4. `pnpm --filter @workspace/tienda run build`
5. Probar catálogo, búsqueda, login, carrito, checkout, webhook Stripe, pedidos y AdminTotal contra el deploy nuevo.
