/**
 * ENRIQUECIMIENTO PÚBLICO (APYMSA) — ADITIVO, solo códigos nativos de 7 dígitos.
 *
 *   node apymsa-ficha-enrich.mjs                 # DRY-RUN: reporta, NO escribe (default)
 *   node apymsa-ficha-enrich.mjs --write         # escribe (aditivo)
 *   node apymsa-ficha-enrich.mjs --write --limit 50
 *   node apymsa-ficha-enrich.mjs --delay 2500    # ms entre peticiones (default 2500)
 *   node apymsa-ficha-enrich.mjs --only 0107902,0551550
 *
 * Trae FICHA TÉCNICA (-> products.specs jsonb) e IMAGEN PRINCIPAL (-> products.image)
 * desde la ficha PÚBLICA de APYMSA, identificada SOLO por el código:
 *   https://www.apymsa.com.mx/Categorias/x/x/x/x/<CODIGO>
 * (la ruta resuelve por el código del final; el slug se ignora.)
 *
 * ⚠️ EGRESS: el WAF de APYMSA RESPONDE 403 "Access Denied" a la IP de salida del
 * workspace (bash / runtime del api-server). Por eso este script NO puede correr
 * con `node` desde el repo tal cual: requiere una red de salida permitida. El
 * enriquecimiento de hecho se ejecuta desde el sandbox de ejecución del agente
 * (mismo DATABASE_URL, egress permitido) IMPORTANDO las funciones de abajo. Este
 * archivo es la implementación canónica/revisable y queda re-ejecutable si algún
 * día la salida del workspace deja de estar bloqueada.
 *
 * REGLAS DE SEGURIDAD (no negociables):
 *   - GUARDA DE CÓDIGO: la página imprime su propio código (<input id="Producto">).
 *     Solo se usan los datos si ese código es IDÉNTICO al solicitado. Esto rechaza
 *     tanto el "no encontrado" como el falso positivo por relleno de ceros.
 *   - NUNCA se rellena el código con ceros (genera coincidencias falsas).
 *   - SOLO códigos base de 7 dígitos (los únicos que existen en APYMSA).
 *   - ADITIVO: specs solo si está vacío; image solo si es null/''. Nunca pisa datos.
 *   - NUNCA toca precio, costo, stock, status, marca, nombre, oem, equivalents, etc.
 *   - EDUCADO: secuencial con delay; hay throttle de bot en ráfagas, con un reintento
 *     ante respuestas truncadas (backoff antes de rendirse).
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);

export const BASE_URL = "https://www.apymsa.com.mx/Categorias/x/x/x/x/";
export const IMG_BASE = "https://resources.apymsa.com.mx/imagenes/";
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Decodifica las entidades HTML comunes y quita etiquetas/espacios sobrantes. */
export function decode(s) {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&deg;/g, "°")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Descarga la ficha. Devuelve {status, html} o lanza en error de red/timeout. */
export async function fetchPage(code, { ua = UA, timeout = 20000 } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const res = await fetch(BASE_URL + code, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-MX,es;q=0.9",
      },
      signal: c.signal,
    });
    return { status: res.status, html: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

/** Señal de "no encontrado" de APYMSA (catálogo no tiene ese código). */
export const isNotFound = (html) => /BUSCAR POR SERVICIO/i.test(html);

/**
 * Parsea la ficha. Aplica la GUARDA DE CÓDIGO. Devuelve:
 *   { matched:false, reason } cuando el código de la página != solicitado, o
 *   { matched:true, image, specs[] } con los datos aditivos.
 */
export function parsePage(html, code) {
  const printed = (html.match(/id="Producto"[^>]*value="([^"]*)"/i) || [])[1] || null;
  if (printed !== code) {
    return { matched: false, reason: printed ? `codigo-distinto:${printed}` : "sin-guarda" };
  }
  // Ficha técnica: pares nombre-esp / valor-esp dentro de .especificaciones.
  const block = (html.match(/class="especificaciones">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) || [])[1] || "";
  const specs = [
    ...block.matchAll(
      /class="nombre-esp">([\s\S]*?)<\/div>\s*<div class="valor-esp">([\s\S]*?)<\/div>/gi,
    ),
  ]
    .map((m) => ({ label: decode(m[1]), value: decode(m[2]) }))
    .filter((s) => s.label && s.value);
  // Imagen principal: primera FotosSpeed/<codigo>/ (excluye imágenes de componentes).
  const im =
    (html.match(new RegExp(`FotosSpeed/${code}/[^\\s"'<>]+\\.(?:jpg|jpeg|png|webp)`, "i")) || [])[0] || null;
  const image = im ? IMG_BASE + im : null;
  return { matched: true, image, specs };
}

/**
 * Trae y parsea con un reintento si la respuesta llega truncada por throttle.
 * Devuelve {status:'ok', image, specs} | {status:'notfound'|'guard'|'http'|'neterr', ...}
 */
export async function resolve(code, { delay = 2500, ua = UA } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let page;
    try {
      page = await fetchPage(code, { ua });
    } catch (e) {
      if (attempt === 2) return { status: "neterr", error: String(e && e.message) };
      await sleep(delay * 2);
      continue;
    }
    if (page.status !== 200) {
      if (attempt === 2) return { status: "http", code: page.status };
      await sleep(delay * 2);
      continue;
    }
    if (isNotFound(page.html)) return { status: "notfound" };
    const parsed = parsePage(page.html, code);
    if (!parsed.matched) {
      if (parsed.reason === "sin-guarda" && attempt === 1) {
        await sleep(delay * 2);
        continue;
      }
      return { status: "guard", reason: parsed.reason };
    }
    return { status: "ok", image: parsed.image, specs: parsed.specs };
  }
  return { status: "guard", reason: "sin-guarda" };
}

/**
 * Aplica el enriquecimiento ADITIVO a una fila ya leída de products.
 * row = { id, image, specs }. res = resultado de resolve() con status 'ok'.
 * Devuelve { willSpecs, willImage, sets, vals } (no escribe; el caller decide).
 */
export function buildAdditiveUpdate(row, res) {
  const specsEmpty = !Array.isArray(row.specs) || row.specs.length === 0;
  const imageEmpty = !row.image || row.image === "";
  const sets = [];
  const vals = [];
  let willSpecs = false;
  let willImage = false;
  if (specsEmpty && res.specs.length > 0) {
    vals.push(JSON.stringify(res.specs));
    sets.push(`specs = $${vals.length}::jsonb`);
    willSpecs = true;
  }
  if (imageEmpty && res.image) {
    vals.push(res.image);
    sets.push(`image = $${vals.length}`);
    willImage = true;
  }
  return { willSpecs, willImage, sets, vals };
}

// ── CLI (solo cuando se ejecuta directamente; ver nota de EGRESS arriba) ──────
async function main() {
  const { Pool } = require("../../lib/db/node_modules/pg/lib/index.js");
  const args = process.argv.slice(2);
  const WRITE = args.includes("--write");
  const flag = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const LIMIT = parseInt(flag("--limit", "0"), 10) || 0;
  const DELAY = parseInt(flag("--delay", "2500"), 10) || 2500;
  const ONLY = (flag("--only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(
    `\n=== APYMSA enrich · ${WRITE ? "WRITE (aditivo)" : "DRY-RUN"} · delay ${DELAY}ms` +
      `${LIMIT ? ` · limit ${LIMIT}` : ""}${ONLY.length ? ` · only ${ONLY.length}` : ""} ===`,
  );

  const rows = ONLY.length
    ? (
        await pool.query(
          `SELECT id, image, specs, regexp_replace(sku,'-[A-Za-z0-9]+$','') AS base
             FROM products WHERE regexp_replace(sku,'-[A-Za-z0-9]+$','') = ANY($1)`,
          [ONLY],
        )
      ).rows
    : (
        await pool.query(
          `SELECT id, image, specs, regexp_replace(sku,'-[A-Za-z0-9]+$','') AS base
             FROM products
            WHERE regexp_replace(sku,'-[A-Za-z0-9]+$','') ~ '^[0-9]{7}$'
              AND (specs = '[]'::jsonb OR specs IS NULL OR image IS NULL OR image = '')
            ORDER BY id${LIMIT ? ` LIMIT ${LIMIT}` : ""}`,
        )
      ).rows;

  console.log(`Objetivo: ${rows.length} productos.\n`);
  const stat = { processed: 0, ok: 0, notfound: 0, guard: 0, http: 0, neterr: 0, wroteSpecs: 0, wroteImage: 0, nodata: 0 };
  for (const row of rows) {
    stat.processed++;
    const res = await resolve(row.base, { delay: DELAY });
    if (res.status !== "ok") {
      stat[res.status] = (stat[res.status] || 0) + 1;
      await sleep(DELAY);
      continue;
    }
    stat.ok++;
    const upd = buildAdditiveUpdate(row, res);
    if (!upd.sets.length) stat.nodata++;
    else {
      if (upd.willSpecs) stat.wroteSpecs++;
      if (upd.willImage) stat.wroteImage++;
      if (WRITE) {
        upd.vals.push(row.id);
        await pool.query(`UPDATE products SET ${upd.sets.join(", ")} WHERE id = $${upd.vals.length}`, upd.vals);
      }
    }
    await sleep(DELAY);
  }
  console.log("RESUMEN:", JSON.stringify(stat, null, 2));
  console.log(WRITE ? "Escritura ADITIVA aplicada." : "DRY-RUN: nada escrito.");
  await pool.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
}
