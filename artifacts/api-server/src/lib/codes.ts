// Symmetric part/OEM-code normalization shared by BOTH sides of the catalog:
//  - WRITE side (enrichment): the value stored in product_oem_codes.code_norm.
//  - SEARCH side (productSearch): the shopper's query before matching code_norm.
//
// These MUST be byte-identical or a search will never find what was written:
// e.g. "23100-4JA0B", "23100 4JA0B" and "231004JA0B" all have to collapse to the
// same "231004JA0B". Keep this the single source of truth — do not re-implement
// the upper/strip rule inline anywhere.
export function normalizeCode(code: string): string {
  return (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
