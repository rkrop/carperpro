/** Format a peso amount as "$1,792.33" (Hermes-safe manual grouping). */
export function formatMXN(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${grouped}.${dec}`;
}

/**
 * Stock status derived from the stored stock level.
 *  - null   → "consultar" (unknown — the ERP hasn't reported a count yet)
 *  - 0      → "agotado"  (confirmed out of stock)
 *  - 1..3   → "bajo"     (last few pieces)
 *  - > 3    → "alto"     (in stock)
 */
export type StockStatus = "alto" | "bajo" | "agotado" | "consultar";

export function stockStatus(stock: number | null): StockStatus {
  if (stock == null) return "consultar";
  if (stock <= 0) return "agotado";
  if (stock <= 3) return "bajo";
  return "alto";
}

export function discountPct(price: number, original: number): number {
  if (!original || original <= price) return 0;
  return Math.round((1 - price / original) * 100);
}
