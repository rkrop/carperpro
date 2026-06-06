---
name: Admin dev-bypass & loopback auth
description: Why /admin auth must decide on the raw socket address (not Host), and how Replit's proxy fools loopback checks
---

# Admin dev-bypass authentication

`authAdmin` (artifacts/api-server/src/routes/admin.ts) allows skipping the Api-key
ONLY for genuine local-dev requests, so the attribute-extraction pilot can be run
with a plain `curl localhost`. The decision lives in `isLocalDevConnection`
(artifacts/api-server/src/lib/loopback.ts, pure + unit-tested).

## The trap
Replit's edge proxy runs INSIDE the container, so a request to the **public** dev
preview URL reaches Express from `127.0.0.1`. A naive "is the peer loopback?" check
therefore treats every public preview request as local → `/admin` was open to anyone
with the URL in dev. Production was safe only because `NODE_ENV=production` disables
the bypass entirely.

**Why:** proxied = public. The only reliable signal that a request is truly local is
that it did NOT come through the proxy.

## The rule (how to apply)
`isLocalDevConnection` returns true only when ALL hold:
1. `NODE_ENV !== "production"`, AND
2. NO `x-forwarded-for` / `x-forwarded-host` header (proxied → always require Api-key), AND
3. `req.socket.remoteAddress` is loopback (127.0.0.1 / ::1 / ::ffff:127.0.0.1).

NEVER use `req.hostname` or the `Host` header for an auth decision — both are
client-controllable and could spoof "localhost". `trust proxy` is 1, so `req.ip`
derives from XFF; use the raw `req.socket.remoteAddress`, not `req.ip`.

Verify after changes: proxied `https://$REPLIT_DEV_DOMAIN/api/admin/...` → 401;
direct `http://127.0.0.1:8080/api/admin/...` → 200.
