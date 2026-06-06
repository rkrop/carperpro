import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePrice, withIva, ESTIMATED_PRICE_MARKUP } from "./pricing.ts";

test("usa el precio de venta cuando es positivo", () => {
  assert.equal(effectivePrice({ price: 1500, costo: 1000 }), 1500);
});

test("cae al costo con markup cuando no hay precio de venta", () => {
  const r = effectivePrice({ price: null, costo: 1000 });
  assert.equal(r, Math.round(1000 * ESTIMATED_PRICE_MARKUP * 100) / 100);
});

test("precio 0 o negativo se trata como ausente (cae a costo)", () => {
  assert.equal(
    effectivePrice({ price: 0, costo: 1000 }),
    Math.round(1000 * ESTIMATED_PRICE_MARKUP * 100) / 100,
  );
  assert.equal(
    effectivePrice({ price: -10, costo: 1000 }),
    Math.round(1000 * ESTIMATED_PRICE_MARKUP * 100) / 100,
  );
});

test("producto sin_precio (sin precio ni costo) regresa 0", () => {
  // Esto es lo que impide cobrar $0: el checkout debe rechazar precio<=0.
  assert.equal(effectivePrice({ price: null, costo: null }), 0);
  assert.equal(effectivePrice({ price: 0, costo: 0 }), 0);
});

test("withIva agrega 16% redondeado a centavos", () => {
  assert.equal(withIva(100), 116);
  assert.equal(withIva(99.99), 115.99);
});
