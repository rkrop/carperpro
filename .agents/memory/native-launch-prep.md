---
name: Native launch prep (iOS/Android)
description: Durable rules for the Carper Expo app's native build/launch config so a future agent doesn't re-derive or break them.
---

# Native launch config (Carper Expo)

**Bundle identity (NEVER change after this initial setup):** both
`ios.bundleIdentifier` and `android.package` = `com.autopartescarper.app`.

**Permission strings MUST match what the code actually does** (Apple rejects
mismatched/unused permissions):
- Camera = photo→AI part identification (NOT barcode). The string was wrong
  before; keep it photo-based.
- Location = **when-in-use only**. The only use is foreground GPS in checkout to
  share the buyer's address with the driver. Do NOT re-add "always".
- Photos via `expo-image-picker` plugin (`photosPermission`) — scanner gallery
  pick.
- Mic/speech via `expo-speech-recognition` plugin; notifications via
  `expo-notifications` plugin. Both must stay in `plugins` because the features
  are used (`lib/push.ts`, voice search).

**iOS specifics:** `infoPlist.ITSAppUsesNonExemptEncryption: false` (standard
crypto only) avoids the export-compliance prompt every submission. The app icon
**MUST be RGB with no alpha** or the App Store rejects it.

**App icon:** brand icon is a bold white "C" on the brand electric-blue
(`#0055FF`), generated **deterministically** (ImageMagick rasterizing an SVG arc
path — `magick ... -alpha remove` to strip alpha), kept inside the Android
adaptive-icon safe zone. Do NOT use AI image-gen for the lettermark (it mangles
glyphs). The old icon was the full CARPER wordmark+tagline on white — unusable at
icon size. splash + adaptiveIcon background also set to `#0055FF`.
**Why deterministic:** the brand is a wordmark; a crisp vector monogram is the
only way to get legible, on-brand letterforms at icon size.

**Production env is auto-injected by `scripts/build.js`** (derives
`EXPO_PUBLIC_DOMAIN` from `REPLIT_INTERNAL_APP_DOMAIN`, inlines
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` + the `/api/__clerk` proxy URL). Do NOT
hardcode domains or keys for production.

**Push projectId** is not pinned in `extra.eas.projectId`; it comes from the
Expo Launch / EAS manifest at build time. `lib/push.ts` is already null-safe, so
dev/Expo Go just returns no token. If a real iOS build gets a null token, pin
`expo.extra.eas.projectId` explicitly.

**Publishing:** iOS App Store is via Replit **Expo Launch** (Publish button)
only. **Android / Google Play publishing is NOT supported on Replit** — the
Android config here just keeps a future external build valid. Never run EAS CLI;
never create app.config.ts/js (Expo Launch needs static app.json).

**Runtime deps MUST live in `dependencies`, not `devDependencies`.** Dev/Expo Go
installs everything so a wrong split is invisible locally, but the Expo Launch
production build can prune devDependencies → `expo`/`react`/`react-native`/
`expo-router` missing → "Failed to publish". Keep ONLY true build tooling
(@babel/core, @expo/cli, @expo/ngrok, babel-plugin-react-compiler, typescript,
@types/*) in devDependencies; every `expo-*`, `react-native-*`, react, expo,
expo-router, fonts, query, etc. go in `dependencies`.
**Why:** publishing failed once because all runtime libs were in devDependencies.

**Clerk pulls Google Sign-In pods → CocoaPods modular-headers failure.**
`@clerk/expo` brings in `ClerkGoogleSignIn → GoogleSignIn → AppCheckCore`, and
the iOS build dies at `pod install` with: "The Swift pod `AppCheckCore` depends
upon `GoogleUtilities` and `RecaptchaInterop`, which do not define modules ...
set `use_modular_headers!`". Fix in the managed app (no hand-edited Podfile) via
the `expo-build-properties` plugin in app.json:
`ios.extraPods` = [{name:"GoogleUtilities",modular_headers:true},
{name:"RecaptchaInterop",modular_headers:true}].
**Why:** the Podfile is generated at build time, so the only supported lever is
the config plugin; targeting just those two pods is lower-risk than flipping
useFrameworks:"static" under New Architecture. Dev/Expo Go is unaffected.
