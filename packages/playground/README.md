# @autofilm/playground

A usable web UI over the autofilm viewer + engine: a **3D viewport** beside a
**humanoid character editor**.

It boots a fully procedural humanoid — a primitive "blockman" rigged on the
normalized VRM bone slots (the bootstrap base 3D model, no external asset) — and
lets you:

- **Reshape** the body live (hip height, torso/limb lengths, shoulder/hip width,
  limb thickness, head size) — each change rebuilds the figure;
- **Pose** it by joint (head tilt, shoulder raise, elbow/knee bend, spine twist)
  — driven through the engine's forward kinematics;
- **Play** a looping wave clip — sampled by the engine each frame.

Nothing here is AI: the editor authors plain `@autofilm/interface` data, the
deterministic `@autofilm/engine` resolves it, and `@autofilm/viewer` (three.js)
draws it.

## Pages

- **`index.html`** — the procedural blockman character editor (above).
- **`drivers.html`** — an engine-drivers demo: a 3-joint arm whose two-bone IK
  (the core resolver) tracks a moving goal every frame.
- **`body.html`** — a **reference hero-base viewer** for the baked human GLB.
  The current bake is a CC0 hybrid scaffold: Blender Studio's realistic female
  body STL, MakeHuman's CC0 head topology / eye proxy, a real MakeHuman skin
  diffuse, and textured MakeHuman bob hair. It is an intermediate base for
  visual iteration, not the final hero-quality character. Build the glTF first:
  `pnpm --filter @autofilm/playground build:human` (fetches/caches the CC0 assets
  and bakes `public/models/human.glb`).
- **`human.html`** — a **real humanoid editor** over a VRM avatar
  (`@pixiv/three-vrm`): live facial **expressions** (happy / angry / sad /
  relaxed / surprised), **gaze** that tracks the viewer, **auto-blink**, and arm
  / head **pose** — the attractive-character path that the procedural blockman
  bootstraps toward.

The model (~14 MB) is not committed; fetch it first:

```bash
packages/playground/scripts/fetch-models.sh   # → public/models/Vita.vrm
```

### Model license

The human editor uses **"Vita"**, a VRoid sample avatar released **CC0 (public
domain)** — no usage, redistribution, or attribution restriction — so it is
fully compatible with this MIT-licensed project. The `.vrm` is fetched on demand,
not committed. To use a different avatar, drop any `.vrm` into `public/models/`
and point `src/human.ts` at it (mind that model's own license).

## Run

```bash
pnpm --filter @autofilm/playground dev      # http://127.0.0.1:5173 (+ /drivers.html, /human.html)
pnpm --filter @autofilm/playground build    # typecheck + production bundle
pnpm --filter @autofilm/playground preview   # serve the build on :4173
```
