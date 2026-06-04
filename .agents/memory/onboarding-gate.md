---
name: Carper welcome/onboarding gate
description: How the first-launch welcome screen gates the app without breaking guest flow
---

# Welcome / onboarding gate

Carper shows a welcome/onboarding screen (`app/bienvenida.tsx`) before the app on
first launch: a 3-slide pager (AI promo images + selling points) with create-account
/ sign-in / explore-as-guest actions.

## Key decisions
- It is a **soft one-time gate, NOT an auth wall.** Auth is optional app-wide (guest
  checkout must keep working), so the gate only fires when the persisted "seen" flag is
  unset AND the user is not signed in. Choosing any action (crear cuenta, iniciar sesión,
  or explorar sin cuenta) marks it seen.

## The non-obvious bug to avoid
- The "seen" flag MUST be **reactive shared state** (a context provider —
  `OnboardingProvider`/`useOnboarding` in `lib/onboarding.tsx`), not a one-shot
  `AsyncStorage.getItem` read inside the gate component.
- **Why:** the gate redirects whenever `seen===false && !signedIn && not on welcome/auth`.
  If marking-seen only writes to storage (without flipping in-memory state), then after
  `router.replace("/(tabs)")` the gate still sees `seen===false` and **bounces the user
  right back to the welcome screen** — the "Explorar sin cuenta" path becomes a loop.
- **How to apply:** `markSeen()` must `setSeen(true)` first (in-memory), then persist.
  The gate reads `seen` from the same context so the change takes effect immediately.
