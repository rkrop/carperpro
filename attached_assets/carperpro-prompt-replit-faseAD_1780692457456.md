# Prompt para Replit — Fase A (estructurar) + Fase D (búsqueda)

```
Contexto: monorepo pnpm. Servidor Express en artifacts/api-server, DB
PostgreSQL + Drizzle en lib/db, búsqueda en lib/productSearch.ts. Existe un
cliente OpenAI llamado description-backfill (gpt-5-nano, json_object,
AbortSignal) — REÚSALO, no crees otro. La API key de OpenAI va en Secrets de
Replit (process.env.OPENAI_API_KEY), NUNCA en el código.

Objetivo: nuestros productos tienen marca/OEM/aplicaciones atrapados como texto
sin estructurar en los campos de descripción. Hay que estructurarlos e
INDEXARLOS para que una búsqueda por código OEM (ej. "23100-4JA0B") o por
vehículo+año (ej. "NP300 2019") encuentre el producto. Todo es ADDITIVE: nunca
toques precio ni stock; solo llena campos vacíos. Trabaja por tareas y
confírmame antes de pasar a la siguiente.

=== FASE A: estructurar lo existente ===

A1 — Esquema (Drizzle, additive, nada destructivo; typecheck debe pasar):
- En products añade nullable: marca (text), ficha_tecnica (jsonb),
  enrichment_source (text), enrichment_confidence (numeric),
  enrichment_review_status (text default 'pending'), enriched_at (timestamp).
- Tabla product_oem_codes: id, product_id (fk), brand (text), code_raw (text),
  code_norm (text), source (text), source_url (text). Índice en code_norm.
- Tabla product_applications: id, product_id (fk), make (text), model (text),
  year_from (int), year_to (int), motor (text), source (text). Índice en
  (make, model).
- Tabla enrichment_staging: id, product_id (fk), field (text),
  proposed_value (jsonb), confidence (numeric), source (text), source_url (text),
  status (text default 'pending'), reviewed_by (text), reviewed_at (timestamp).

A2 — Módulo de extracción src/lib/attribute-extraction.ts:
- Reusa el cliente description-backfill (gpt-5-nano, json_object, timeout/
  AbortSignal).
- Función extractAttributes({ codigo, nombre, descripcion }) → objeto:
  { marca, ficha_tecnica:{...}, oem:[{brand,code}], aplicaciones:[{make,model,
  year_from,year_to,motor}], confidence }.
- Prompt estricto en español: "Extrae SOLO lo que esté literalmente en el texto
  dado. No inventes. marca = fabricante de la pieza (Bosch, Valeo, Mitsubishi…),
  NO la marca del vehículo. oem = códigos de parte/equivalencias con su
  fabricante. aplicaciones = vehículos compatibles con marca, modelo, años de
  inicio/fin y motor si aparece. Si un dato no está, omítelo."
- IMPORTANTE: deja un hook validateGrounding(values, sourceText) y un hook
  normalizeCodes(oem) marcados con TODO — esas dos funciones las implemento yo
  aparte (anclaje word-boundary contra el texto, y normalización de códigos).
  Por ahora que validateGrounding devuelva los valores tal cual y normalizeCodes
  haga un stub: code_norm = code en mayúsculas sin [^A-Z0-9]. Expón ambas para
  poder sustituirlas.
- Devuelve también qué campos llenaría (wouldWrite) comparando contra los campos
  hoy vacíos del producto.

A3 — Runner + ruta admin (dry-run por defecto):
- runEnrichmentBatch({ limit, write }) selecciona productos vendibles/no-test
  con campos objetivo vacíos; corre extractAttributes con concurrencia pequeña
  (ej. 4); arma reporte antes/después.
- write=false (default): escribe SOLO a enrichment_staging (un registro por
  campo propuesto), NO a products / product_oem_codes / product_applications.
- write=true: tras aprobación, escribe additive SOLO de campos vacíos y
  confidence >= 0.8; inserta en product_oem_codes (con code_norm) y
  product_applications; marca enrichment_review_status.
- src/routes/admin.ts: POST /api/admin/enrichment/run, token-gated (reusa el
  token de webhook; en dev permite sin token). Registra en routes/index.ts.
- Acepta: curl devuelve reporte JSON; en dry-run no se modifica products ni las
  tablas finales.

=== FASE D: búsqueda ===

D1 — Asegura los índices de A1 (code_norm; make,model) y un índice de texto
para nombre si no existe.

D2 — En lib/productSearch.ts:
- Búsqueda por código: normaliza la consulta del usuario igual que code_norm
  (mayúsculas, quita todo lo que no sea A-Z0-9) y busca coincidencia exacta o
  por prefijo en product_oem_codes.code_norm. Una coincidencia de código = la
  máxima prioridad en el ranking.
- Filtro por vehículo/año: si la consulta trae un modelo y un año, filtra
  product_applications: model ILIKE ... AND año BETWEEN year_from AND year_to.
- Ranking ponderado: code_norm exacto > marca > aplicaciones > texto del nombre.
- No rompas la búsqueda actual; añade estas señales encima.
- Acepta: buscar "23100-4JA0B" (con o sin guiones) y "NP300 2019" devuelve el
  producto correcto y bien rankeado.

NO toques: lógica de pagos Stripe, autorización de rutas /me, borrado de cuenta,
ni precio/stock. El adaptador de scraping de APYMSA NO va en esta fase.
```
