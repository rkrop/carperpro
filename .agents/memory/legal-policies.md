---
name: Legal policies & account deletion
description: How the privacy/cookies/terms text must mirror real behavior, and how in-app account deletion works across both auth methods.
---

# Legal policies (Aviso de Privacidad, Cookies, Términos)

The MX policy set is ONE structured module (`policies.ts`) and MUST stay
**byte-identical** between `artifacts/carper/lib/policies.ts` and
`artifacts/tienda/src/lib/policies.ts` (edit carper, then `cp` + `cmp`). It is
bundled into both the app and the website (the app must render them offline for
store review), so mirror every edit or app/web diverge.

Razón social = **CARPER DISTRIBUIDORA SA DE CV**. These policies still need a
lawyer review before launch.

**Rule: the policy text must describe what the code actually does.**
- Disclose the AI provider as a data transfer. The app sends search text and
  scanner photos to Google/Gemini, so the Aviso de Privacidad must list AI/cloud
  providers + a possible-cross-border-transfer sentence. Same for auth provider.
- Cookies = **Esenciales + De preferencia only**. There is NO analytics tool
  (no GA/Segment), and the **website has no cart** (tienda is WhatsApp-only). Do
  not re-add analytics or a web "carrito" claim.
- ARCO contact email is `STORE.email` (currently on the `puntorefaccionario.com`
  domain, a sister brand — verify it's monitored before changing).

# In-app account deletion (ARCO "Cancelación")

**Why:** Apple/Google require in-app account deletion for any app that lets users
create an account; LFPDPPP requires honoring ARCO Cancelación.

`DELETE /api/me` (gated by requireAuth+provisionUser on `/me`), in one DB tx:
- NULL `outbound_orders.userId` — **retain** orders/billing for fiscal + PROFECO
  duties, but disassociate from the account (orders carry a buyer snapshot).
- Explicitly delete `push_tokens` and `back_in_stock_subs` (these have **no FK**
  to users, so no cascade).
- Delete the `users` row → FK `onDelete: cascade` removes `user_favorites`,
  `user_addresses`, `phone_sessions`.
- Then (outside tx) for **non-`phone_` ids only**, `clerkClient.users.deleteUser`
  to remove the IdP login. This is **best-effort**: the route still returns 204 if
  Clerk fails (server data is already gone; the warning is logged).

Client `deleteAccount()` in `lib/auth.tsx` sends the DELETE with the active token,
then clears local state for both methods (Clerk `signOut` + phone
`clearPhoneSession`). UI: destructive "Eliminar cuenta" row in Cuenta › Ajustes,
with a confirm Alert. The privacy text points users to that exact path.
