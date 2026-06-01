# @motica/playground

A usable web UI over the motica viewer + engine: a **3D viewport** beside a
**humanoid character editor**.

It boots a fully procedural humanoid — a primitive "blockman" rigged on the
normalized VRM bone slots (the bootstrap base 3D model, no external asset) — and
lets you:

- **Reshape** the body live (hip height, torso/limb lengths, shoulder/hip width,
  limb thickness, head size) — each change rebuilds the figure;
- **Pose** it by joint (head tilt, shoulder raise, elbow/knee bend, spine twist)
  — driven through the engine's forward kinematics;
- **Play** a looping wave clip — sampled by the engine each frame.

Nothing here is AI: the editor authors plain `@motica/interface` data, the
deterministic `@motica/engine` resolves it, and `@motica/viewer` (three.js)
draws it.

## Pages

- **`index.html`** — the procedural blockman character editor (above).
- **`drivers.html`** — an engine-drivers demo: a 3-joint arm whose two-bone IK
  (the core resolver) tracks a moving goal every frame.
- **`human.html`** — a **real humanoid editor** over a VRoid `AvatarSample` VRM
  (`@pixiv/three-vrm`): live facial **expressions** (happy / angry / sad /
  relaxed / surprised), **gaze** that tracks the viewer, **auto-blink**, and arm
  / head **pose** — the attractive-character path that the procedural blockman
  bootstraps toward.

The VRM sample avatars (~15 MB each, free) are not committed; fetch them first:

```bash
packages/playground/scripts/fetch-models.sh   # → public/models/*.vrm
```

## Run

```bash
pnpm --filter @motica/playground dev      # http://127.0.0.1:5173 (+ /drivers.html, /human.html)
pnpm --filter @motica/playground build    # typecheck + production bundle
pnpm --filter @motica/playground preview   # serve the build on :4173
```
