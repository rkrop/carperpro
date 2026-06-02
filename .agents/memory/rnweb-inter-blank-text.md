---
name: RN-web Inter blank text on post-mount remount
description: Why custom-font Text renders invisible on react-native-web after a state-driven subtree swap, and how to avoid it
---

On react-native-web (Expo Metro web preview), `Text` using a custom loaded family
(e.g. Inter via `@expo-google-fonts/inter`) can render **completely blank** when the
text node first mounts *after* the initial paint as the result of a state change that
swaps one subtree for another — classically a loading skeleton (`loading ? <Skeleton/> : <List/>`)
flipping to the loaded list. SpaceMono and View backgrounds still paint; only the
custom-family Text is invisible. It does not self-heal within the bad frame.

**Why:** empirically tied to the post-paint remount of the Text subtree (the
`Animated.View`-based skeleton swap was the trigger in practice). Content that is present
on the *first* mount (e.g. a synchronously-resolved product detail screen, or a static
EmptyState) renders fine. This is a web-only quirk — native Android/iOS bundle the fonts
and load them before first paint, so the issue never appears there.

**How to apply:** when the artifact targets native but you still preview on web, gate any
artificial loading/skeleton delay to native only — e.g. `useState(!isWeb)` for the loading
flag and `useEffect(() => { if (isWeb) return; /* start timer */ }, [])`, with
`isWeb` from `constants/fonts`. Prefer rendering final content on first mount on web.
If you must show async/storage-hydrated lists on web, be aware the empty→list swap is the
same class of trigger; the safest bet is to keep target=native and treat web as a rough preview.
`removeClippedSubviews={false}` does NOT fix it; converting FlatList→ScrollView+map plus
native-gating the loading state did.
