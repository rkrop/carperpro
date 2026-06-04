---
name: Carper voice search
description: How the search-bar microphone does real voice-to-text across web + native, and the Expo Go constraint.
---

# Carper voice search (mic in the search bar)

Real speech-to-text lives in `hooks/useVoiceSearch.ts` and is consumed by the
Buscar screen; the `SearchHeader` mic on non-editable screens deep-links to
`/(tabs)/buscar?voice=1` which auto-starts voice once.

## Decisions
- Library: **`expo-speech-recognition`** (jamsch). It has a real **web**
  implementation (wraps the browser Web Speech API) AND native iOS/Android, so the
  hook uses ONE module for all platforms — no custom Web Speech API branch.
- **Version is SDK-pinned**: use `3.1.3` for Expo SDK 54. The npm `latest`
  (56.x) targets SDK 56 and is wrong here. Re-check the matching dist-tag when the
  Expo SDK is upgraded.
- Module is loaded with a **guarded `require()` in try/catch at module scope**.
  In Expo Go the native binding isn't bundled and the require throws — catching it
  yields `supported:false` instead of crashing the whole app on startup.
- `supported` comes from `isRecognitionAvailable()`; `start()` is async, requests
  permission, returns `false` on deny/unsupported. Only **final, non-empty**
  results are submitted (`interimResults:false`, `lang:"es-MX"`).
- Permissions are declared via the config plugin in `app.json` (microphone +
  speech, Spanish strings).

**Why:** the original mic was a mock (always searched "marcha tsuru"). The expo
skill steers toward Expo-Go-only libs, but on-device voice is impossible in Expo
Go, and the app ships via Expo Launch (real builds) which support config-plugin
native modules.

**How to apply:** native voice only works in a real build (Expo Launch / dev
build) or in the web preview. Expo Go shows the graceful "no disponible" alert by
design — don't treat that as a bug.
