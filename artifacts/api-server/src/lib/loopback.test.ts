import { test } from "node:test";
import assert from "node:assert/strict";
import { isLoopbackHost, isLocalDevConnection } from "./loopback.ts";

test("reconoce localhost y loopback IPv4/IPv6", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("::ffff:127.0.0.1"), true);
});

test("ignora el puerto al evaluar el host", () => {
  assert.equal(isLoopbackHost("localhost:8080"), true);
  assert.equal(isLoopbackHost("127.0.0.1:443"), true);
});

test("un preview público de Replit NO es loopback", () => {
  assert.equal(isLoopbackHost("ejemplo.replit.dev"), false);
  assert.equal(isLoopbackHost("autopartescarper.com"), false);
});

test("valores vacíos o indefinidos NO son loopback", () => {
  assert.equal(isLoopbackHost(undefined), false);
  assert.equal(isLoopbackHost(""), false);
  assert.equal(isLoopbackHost("   "), false);
});

test("hosts que solo contienen la palabra no engañan", () => {
  assert.equal(isLoopbackHost("notlocalhost"), false);
  assert.equal(isLoopbackHost("localhost.evil.com"), false);
});

test("isLocalDevConnection: curl directo a loopback en dev permite bypass", () => {
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "development",
      remoteAddress: "127.0.0.1",
      hasForwardedHeaders: false,
    }),
    true,
  );
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "development",
      remoteAddress: "::ffff:127.0.0.1",
      hasForwardedHeaders: false,
    }),
    true,
  );
});

test("isLocalDevConnection: producción NUNCA hace bypass", () => {
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "production",
      remoteAddress: "127.0.0.1",
      hasForwardedHeaders: false,
    }),
    false,
  );
});

test("isLocalDevConnection: petición proxiada (preview público) exige Api-key", () => {
  // El proxy de Replit conecta desde loopback pero añade X-Forwarded-*.
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "development",
      remoteAddress: "127.0.0.1",
      hasForwardedHeaders: true,
    }),
    false,
  );
});

test("isLocalDevConnection: socket no-loopback no hace bypass", () => {
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "development",
      remoteAddress: "203.0.113.7",
      hasForwardedHeaders: false,
    }),
    false,
  );
  assert.equal(
    isLocalDevConnection({
      nodeEnv: "development",
      remoteAddress: undefined,
      hasForwardedHeaders: false,
    }),
    false,
  );
});
