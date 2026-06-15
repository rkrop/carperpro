---
name: Carper promo video
description: The animated brand video artifact for Carper Autopartes (video-js)
---

- Artifact slug `carper-video`, preview path `/video/`, kind=video (video-js scaffold). Not deployable — exported from the preview pane.
- 6 scenes, 48s total (intro 4s, catalog 8s, search 10s, scanner 10s, purchase 10s, outro 6s). SCENE_DURATIONS exported from VideoTemplate.tsx.
- Spanish es-MX formal/usted, no emojis. Premium slate/blue/red automotive palette.
- DESIGN subagent built the scenes; main agent added bg music (public/audio/bg_music.mp3) + scene-selector/audio controls (VideoWithControls, useSceneControls) per video-js skill. Controls render only inside iframe; export path = bare <VideoTemplate/>.
- **Why:** video-js skill requires delegation of the creative build to a DESIGN subagent and forbids telling it about scene selectors/audio (main-agent post-build step).
