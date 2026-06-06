import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { addHost, firstPartyHosts, isAllowedCorsOrigin } from "./cors.ts";

const ENV_KEYS = [
  "NODE_ENV",
  "REPLIT_DOMAINS",
  "REPLIT_DEV_DOMAIN",
  "EXPO_PUBLIC_DOMAIN",
  "PUBLIC_SITE_URL",
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
  addHost(hosts, "ejemplo.replit.dev:443");
  addHost(hosts, "  ");
  addHost(hosts, undefined);
  assert.ok(hosts.has("autopartescarper.com"));
  assert.ok(hosts.has("ejemplo.replit.dev"));
  assert.equal(hosts.size, 2);
});

test("firstPartyHosts incluye PUBLIC_SITE_URL y REPLIT_DOMAINS", () => {
  process.env.PUBLIC_SITE_URL = "https://autopartescarper.com";
  process.env.REPLIT_DOMAINS = "a.replit.app,b.replit.app";
  process.env.REPLIT_DEV_DOMAIN = "dev.replit.dev";
  const hosts = firstPartyHosts();
  assert.ok(hosts.has("autopartescarper.com"));
  assert.ok(hosts.has("a.replit.app"));
  assert.ok(hosts.has("b.replit.app"));
  assert.ok(hosts.has("dev.replit.dev"));
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
