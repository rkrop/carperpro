import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedInt, optionalString, MAX_PRODUCT_ID_LENGTH } from "./httpParams.ts";

// Topes equivalentes a los usados en routes/catalog.ts.
const MAX_PRODUCT_LIMIT = 200;
const MAX_OFFSET = 10_000;

test("boundedInt regresa el fallback ante valores no numéricos", () => {
  assert.equal(boundedInt(undefined, 50, 1, MAX_PRODUCT_LIMIT), 50);
  assert.equal(boundedInt("abc", 50, 1, MAX_PRODUCT_LIMIT), 50);
  assert.equal(boundedInt(NaN, 0, 0, MAX_OFFSET), 0);
});

test("boundedInt acota por arriba (protección DoS de limit)", () => {
  assert.equal(boundedInt("9999", 50, 1, MAX_PRODUCT_LIMIT), MAX_PRODUCT_LIMIT);
  assert.equal(boundedInt("500000", 0, 0, MAX_OFFSET), MAX_OFFSET);
});

test("boundedInt acota por abajo y trunca decimales", () => {
  assert.equal(boundedInt("-5", 50, 1, MAX_PRODUCT_LIMIT), 1);
  assert.equal(boundedInt("0", 50, 1, MAX_PRODUCT_LIMIT), 1);
  assert.equal(boundedInt("12.9", 50, 1, MAX_PRODUCT_LIMIT), 12);
});

test("boundedInt acepta valores válidos dentro del rango", () => {
  assert.equal(boundedInt("50", 50, 1, MAX_PRODUCT_LIMIT), 50);
  assert.equal(boundedInt("200", 50, 1, MAX_PRODUCT_LIMIT), 200);
});

test("optionalString recorta y valida cadenas", () => {
  assert.equal(optionalString("  hola  "), "hola");
  assert.equal(optionalString(""), undefined);
  assert.equal(optionalString("   "), undefined);
  assert.equal(optionalString(123), undefined);
  assert.equal(optionalString(undefined), undefined);
});

test("optionalString rechaza cadenas que exceden el límite", () => {
  const ok = "a".repeat(MAX_PRODUCT_ID_LENGTH);
  const tooLong = "a".repeat(MAX_PRODUCT_ID_LENGTH + 1);
  assert.equal(optionalString(ok), ok);
  assert.equal(optionalString(tooLong), undefined);
});
