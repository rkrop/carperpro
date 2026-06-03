---
name: Phone OTP auth (second login method)
description: How phone+SMS OTP login coexists with Clerk in Carper (server opaque sessions + client unified useAuth).
---

Carper supports TWO login methods side by side: Clerk (email/Google) AND custom phone+SMS OTP (Twilio Verify). They must never break each other.

**Server side**
- Phone users get `users.id = "phone_<uuid>"` with `phone` set at verify time. Identity column (`users.id`) is shared by both methods; favorites/addresses/orders FK to it unchanged.
- Opaque sessions: tokens prefixed `cps_` so Clerk middleware ignores them (not JWTs); only the sha256 hash is stored in `phone_sessions`. 60-day TTL.
- `getOptionalUserId` reads Clerk first, then falls back to `req.phoneUserId` (set by `attachPhoneAuth`, mounted AFTER clerkMiddleware). `requireAuth` builds on it. `ensureUser` skips Clerk enrichment for `phone_` ids.
- Routes: POST /api/auth/phone/{start,verify,signout}. start=Verify send, verify=Verify check → find/create phone user → mint session → `{token,expiresAt,userId}`.

**Client side (Expo)**
- `lib/auth.tsx` exports a unified `useAuth()` that merges Clerk's useAuth + a `PhoneAuthProvider` (token in expo-secure-store). Clerk takes precedence when both present. Returns `{isLoaded,isSignedIn,userId,method,getToken,signOut}`.
- ALL app code imports `useAuth` from `@/lib/auth`, NOT `@clerk/expo` (sign-in/sign-up still import useSignIn/useSignUp from clerk). ApiAuthBridge feeds the unified getToken into `setAuthTokenGetter`.
- `PhoneAuthProvider` must sit inside ClerkProvider/ClerkLoaded (the unified hook calls Clerk's useAuth) and wrap ApiAuthBridge.
- UI: `PhoneAuthSection` in components/AuthUI.tsx (idle→phone→code state machine) dropped into both sign-in and sign-up.

**Gotcha — route prefix:** api-server mounts sub-routers via `app.use("/api", router)`, so sub-router paths are RELATIVE (e.g. `/auth/phone/start`, `/me/favorites`). Prefixing `/api/...` inside a sub-router yields `/api/api/...` → 404. Twilio Verify findings live in twilio-verify.md.
