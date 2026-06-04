// Code normalization + the "never price 0" rule, shared by the ERP mapper and the
// inbound webhooks so every write path behaves identically.
//
// IMPORTANT: `normalizeSkuBase` must match the SQL that maintains the stored
// `sku_base` column in `ensure-search-trigger.ts`
//   upper(regexp_replace(split_part(sku,'-',1), '[[:space:]]+', '', 'g'))
// and the copy in `import-maestro.mjs`. The trigger fills the stored value; this
// normalizes the bare code an incoming webhook sends so the lookup matches.

export function normalizeSkuBase(sku: string | null | undefined): string {
  if (!sku) return "";
  return String(sku).split("-")[0].replace(/[\s]+/g, "").trim().toUpperCase();
}

// Markup applied to costo when a product has no sale price but a known cost, so we
// never surface a $0 price (the "nunca precio 0" rule).
export const ESTIMATED_PRICE_MARKUP = 1.3;

export type PriceStatus = "activo" | "sin_precio";

export interface PriceResolution {
  price: number;
  priceSource: string | null;
  status: PriceStatus;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Apply the never-price-0 rule on a write:
//   • valid sale price          -> use it, source = `sourceWhenValid`.
//   • no price but a cost        -> price = costo * 1.30, source = "Estimado".
//   • neither price nor cost     -> price 0, status "sin_precio" (hidden by catalog).
// `sourceWhenValid` is the label to record when the sale price is usable, e.g.
// "Matriz"/"Bodega" on master import, "Webhook" on a live price/stock push.
export function resolvePrice(
  precio: number | null | undefined,
  costo: number | null | undefined,
  sourceWhenValid: string,
): PriceResolution {
  const p = typeof precio === "number" && Number.isFinite(precio) ? precio : 0;
  const c = typeof costo === "number" && Number.isFinite(costo) ? costo : 0;
  if (p > 0) return { price: round2(p), priceSource: sourceWhenValid, status: "activo" };
  if (c > 0)
    return {
      price: round2(c * ESTIMATED_PRICE_MARKUP),
      priceSource: "Estimado",
      status: "activo",
    };
  return { price: 0, priceSource: null, status: "sin_precio" };
}
