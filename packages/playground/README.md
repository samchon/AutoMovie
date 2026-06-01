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

## Run

```bash
pnpm --filter @motica/playground dev      # http://127.0.0.1:5173
pnpm --filter @motica/playground build    # typecheck + production bundle
pnpm --filter @motica/playground preview   # serve the build on :4173
```
