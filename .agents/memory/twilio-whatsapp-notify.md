---
name: Twilio WhatsApp notifications
description: How to send WhatsApp/SMS via the Twilio Messages API on Carper, and the sender/template constraints that decide whether messages actually deliver.
---

# Twilio Messages API (WhatsApp/SMS) on Carper

The Carper Twilio **connector exposes only the API Key SID** (in the `account_sid`
field) and its secret (`api_key_secret`); the `phone_number`; and an `api_key`
field that is NOT the account SID (a `ca…` value). The Messages API path
(`/2010-04-01/Accounts/{AccountSid}/Messages.json`) requires the real **AC**
account SID, which the connector does not give you.

**Resolve the AC SID at runtime**: validate the `api_key` hint against
`/^AC[0-9a-f]{32}$/`; if it fails, `GET /Accounts.json` (Basic auth = API Key
SID:secret) and take `accounts[0].sid`. Cache in-process.
**Why:** the connector mislabels fields (same quirk as Twilio Verify); without
the AC SID the Messages endpoint 404s.

## WhatsApp deliverability gates (the real blockers)
Sending WhatsApp is NOT just auth — the `From` must be a **registered WhatsApp
sender (channel) on the connected account**:
- **63007 "could not find a Channel with the specified From address"** → that
  WhatsApp `From` is not a sender on this account at all (it may live on a
  different Twilio account, or was never registered). Check with
  `GET https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp`.
- **63016** → sender exists but you're sending free-form outside the 24 h
  customer-care window → needs an **approved Content template** (HX… ContentSid).

**Why this matters:** a fresh Twilio account (or one connected to the wrong
project) has zero WhatsApp senders, so the feature can be fully built, typecheck,
and reach Twilio with correct auth yet never deliver until the user registers a
WhatsApp sender (Meta verification, can take days) or you use the Sandbox
(`whatsapp:+14155238886`, recipient must `join` first, 24 h window).

**How to apply:** keep the channel configurable via env
(`CARPER_NOTIFY_WHATSAPP_FROM/TO`, optional `CARPER_NOTIFY_WHATSAPP_TEMPLATE_SID`)
so switching sender, sandbox, or SMS is a config change, not a code change.
SMS (plain `From`/`To`, no `whatsapp:`) works immediately with the existing
`phone_number` and needs no sender registration or template.

## Exactly-once paid notification
Card orders fire the notification at the single-winner unpaid→paid transition:
the conditional `UPDATE ... WHERE paymentStatus='unpaid' ... RETURNING` — only the
caller that gets a row back notifies, so concurrent webhook/return-verify/
scheduler calls never double-send. Notification is fire-and-forget (never blocks
or throws into fulfillment). Cash/SPEI orders stay `unpaid`, so they do not
trigger it.
