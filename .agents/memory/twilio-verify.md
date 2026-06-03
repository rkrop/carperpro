---
name: Twilio Verify via connector
description: How to use the Replit Twilio connector for SMS OTP (Verify) in this repo
---

Twilio SMS OTP in Carper uses **Twilio Verify called directly over HTTPS**, NOT the connector proxy and NOT the SDK client.

**Why:** The Replit Twilio connector proxy is locked to `api.twilio.com` (verify.twilio.com is unreachable), and the proxy's injected Basic auth fails with 20003 "invalid username" for this connection. The SDK `proxy()`/`listConnections()` do NOT expose raw credentials at runtime.

**How to apply:**
- Fetch raw credentials at runtime: `GET {resolveBaseUrl()}/api/v2/connection?connector_names=twilio&include_secrets=true` with `await buildHeaders()` from `@replit/connectors-sdk/identity.js` (require the subpath directly; not exported from index). Response `items[0].settings` = `{ account_sid, api_key, api_key_secret, phone_number }`. Never cache/log the secret.
- This connection's fields are mislabeled: `account_sid` actually holds the **API Key SID (SK...)**, `api_key` is junk (`ca...`). Verify Basic auth that works = username `settings.account_sid` (the SK) + password `settings.api_key_secret`. The `api_key` field 401s.
- Verify endpoints (no AccountSid in path): `https://verify.twilio.com/v2/Services/{SID}/Verifications` (start) and `/VerificationCheck` (check). Service SID stored in env `TWILIO_VERIFY_SERVICE_SID` (shared, non-secret).
