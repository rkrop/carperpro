# AGENTS.md — Contexto para Codex / agentes de IA

Este archivo orienta a Codex CLI (y otros agentes) al auditar o mejorar el proyecto.

## Qué es el proyecto
Carper Autopartes — catálogo y tienda de autopartes para México. Monorepo **pnpm**.

Artefactos (carpeta `artifacts/`):
- **api-server** (Express, build con esbuild) — sirve la API en `/api`.
- **carper** (Expo / React Native) — app móvil, en `/app`.
- **tienda** (React + Vite) — website público, en `/`.
- **mockup-sandbox** — entorno de previsualización de componentes (no es producto final).

Librerías compartidas en `lib/` (p. ej. `lib/db` = esquema Drizzle + acceso a Postgres).

## Reglas de negocio que NO se deben romper
- **Idioma:** español de México, trato **FORMAL (usted)** en todo texto de cara al usuario.
- **Identidad de producto:** `código = id = sku`. No inventar ni renombrar identificadores.
- **never-price-0:** nunca mostrar ni cobrar precio 0. El precio efectivo = precio de venta si > 0, si no el costo (helper `effectivePrice()`).
- **Enriquecimiento ADITIVO:** los procesos de enriquecimiento solo llenan campos vacíos; nunca tocan precio ni stock.
- **Stock:** un solo número nullable por producto (`products.erpStockQty`); NULL = desconocido (se muestra), 0 = oculto.

## Convenciones técnicas
- Base de datos: **Drizzle ORM** + Postgres. Las migraciones son vía `drizzle-kit push` (no hay archivos de migración generados). El esquema vive en `lib/db/src/schema/`.
- Tras editar tipos en `lib/db`, correr `npx tsc -b lib/db` antes de typecheck de api-server.
- Typecheck global: `pnpm run typecheck`. Build: `pnpm run build`.
- Las rutas de la API montan en `/api/*`.
- No exponer ni escribir secretos en el código. Las API keys viven en los Secrets de Replit.

## Cómo correr Codex aquí
- Auditoría (solo lectura): `./scripts/codex.sh exec "describe la auditoría que quieres"`
- Aplicar mejoras (permite editar): `./scripts/codex.sh --sandbox workspace-write exec "..."`
- Configuración del modelo y sandbox: `.codex/config.toml`.
