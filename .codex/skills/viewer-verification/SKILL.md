# Viewer Verification

Unit tests pin the engine's numbers; they cannot tell you the character renders right. Any change to `viewer`, to the render path, or to a pose/motion/expression that is meant to look a certain way is verified visually by driving the viewer through **Playwright MCP**, not by a green test run alone.

## When to verify visually

- A `@motica/viewer` change (model/scene builder, pose application, material, camera, lights, the player loop).
- A new or changed pose, motion clip, or expression whose correctness is "it looks like X".
- A render-output or headless-snapshot change.
- Before reporting any of the above as working.

## Flow

1. Launch the viewer host (the playground / website page that mounts `mountViewer`, or a minimal page that builds a model and applies the pose). The page needs a real WebGL context, so it runs in the browser Playwright drives, not headless Node.
2. Drive it with Playwright MCP: load the page, set the model and the pose/motion, advance the player to the target time, and take a screenshot.
3. Read the screenshot back and check it against the intended result: the bones bend the right way, the limbs sit where forward kinematics says, the expression shows the named emotion, the camera frames the subject, materials and lighting are sane.
4. For motion, sample several timestamps (start, midpoints, end) and confirm the in-betweens are coherent, not just the keyframes.
5. Report concrete observations tagged `[regression]` / `[polish]` / `[nit]` / `[ok]`. Fix obvious visual breaks in the same turn before continuing.

## Cross-check against the engine

A render that disagrees with `resolvePose`/`sampleMotion` output is a viewer bug; a render that agrees but still looks wrong is an engine or data bug. State which side the discrepancy is on. The viewer is a thin projection of the engine's deterministic result, so the two must match.
