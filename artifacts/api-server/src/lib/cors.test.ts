import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { addHost, firstPartyHosts, isAllowedCorsOrigin } from "./cors.ts";

const ENV_KEYS = [
  "NODE_ENV",
  "PUBLIC_SITE_URL",
  "PUBLIC_API_URL",
  "APP_PUBLIC_URL",
  "EXPO_PUBLIC_API_URL",
  "ALLOWED_ORIGINS",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test("addHost extrae hostname de URLs y de host:puerto", () => {
  const hosts = new Set<string>();
  addHost(hosts, "https://autopartescarper.com");
  addHost(hosts, "api.carper.test:443");
  addHost(hosts, "  ");
  addHost(hosts, undefined);
  assert.ok(hosts.has("autopartescarper.com"));
  assert.ok(hosts.has("api.carper.test"));
  assert.equal(hosts.size, 2);
});

test("firstPartyHosts incluye dominios propios y ALLOWED_ORIGINS", () => {
  process.env.PUBLIC_SITE_URL = "https://autopartescarper.com";
  process.env.PUBLIC_API_URL = "https://api.autopartescarper.com";
  process.env.ALLOWED_ORIGINS = "https://admin.autopartescarper.com,https://tienda.autopartescarper.com";
  const hosts = firstPartyHosts();
  assert.ok(hosts.has("autopartescarper.com"));
  assert.ok(hosts.has("api.autopartescarper.com"));
  assert.ok(hosts.has("admin.autopartescarper.com"));
  assert.ok(hosts.has("tienda.autopartescarper.com"));
});

test("sin Origin se permite (same-origin, móvil, curl, webhooks)", () => {
  process.env.NODE_ENV = "production";
  assert.equal(isAllowedCorsOrigin(undefined), true);
  assert.equal(isAllowedCorsOrigin(""), true);
});

test("permite Origin de un host first-party (dominio público)", () => {
  process.env.NODE_ENV = "production";
  process.env.PUBLIC_SITE_URL = "https://autopartescarper.com";
  assert.equal(isAllowedCorsOrigin("https://autopartescarper.com"), true);
});

test("rechaza Origin de un host externo desconocido", () => {
  process.env.NODE_ENV = "production";
  process.env.PUBLIC_SITE_URL = "https://autopartescarper.com";
  assert.equal(isAllowedCorsOrigin("https://evil.example.com"), false);
});

test("en producción NO se permite localhost", () => {
  process.env.NODE_ENV = "production";
  assert.equal(isAllowedCorsOrigin("http://localhost:5173"), false);
});

test("en desarrollo SÍ se permite localhost/127.0.0.1", () => {
  process.env.NODE_ENV = "development";
  assert.equal(isAllowedCorsOrigin("http://localhost:5173"), true);
  assert.equal(isAllowedCorsOrigin("http://127.0.0.1:3000"), true);
});

test("rechaza un Origin malformado", () => {
  process.env.NODE_ENV = "production";
  assert.equal(isAllowedCorsOrigin("no-es-una-url"), false);
});
