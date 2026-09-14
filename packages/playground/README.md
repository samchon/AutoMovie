# @automovie/playground

Browser development surfaces for inspecting engine geometry, poses, motion, cameras and object placement. Most pages use the AutoMovie viewer; the anatomical face editor loads its actual exported GLB with Three.js.

## Run

```bash
pnpm --filter @automovie/playground dev
pnpm --filter @automovie/playground build
pnpm --filter @automovie/playground preview
```

The default development URL is `http://127.0.0.1:5173`. The development command first builds `@automovie/human`, including its schema-transformed browser entry. After changing human source, rebuild that package and reload the editor.

## Anatomical face editor

Open `/face.html`. The editor consumes [human](../human/README.md) and the nineteen numerical [subject documents](../../test/src/subjects/human-face-documents), not photographs or a live fitting service. The old face-package page and `/head.html` have been retired.

Select a subject, adjust intermediate traits or an anatomical detail, and wait for the worker to build the model. Scalar fields show units and applied values; the region JSON editor handles nested objects and complete arrays. Eyes, cheeks and ears have independent side overrides. Expression controls and presets include paired blink, brow, smile and gaze plus jaw opening, lip separation and pucker. Camera presets, orbit controls and clay help inspect geometry.

Fit frames the complete three-dimensional face and hair envelope for every orbit direction. It accounts for the viewport aspect and optical zoom, and expands the orbit limit and clipping range when needed. This changes only inspection, never the saved face or its exported geometry.

Appearance exposes linear RGB, surface roughness and clearcoat strength for skin, lips, brows, teeth and the resident finish named by the applied hair profile. A custom hair-material id is editable too. Roughness and clearcoat use [0,1]; absent clearcoat displays zero without changing the document until an edit is committed. Each entry changes only its selected coefficient or colour channel and retains the guide geometry, texture coverage and other finish properties. Choosing a different hair finish through region replacement moves these controls to that owner.

A rejected edit preserves the last valid document/model. Undo, redo and reset operate on successful edits. Save/load JSON keeps the complete numerical basis and explicit overrides. GLB is self-contained; glTF downloads include sibling buffers and any resident PNG images, which must stay alongside the JSON file. Downloaded meshes represent the current built expression, not a rigged animation. Generated geometry and unresolved likeness are separate outcomes.

Pure editor adapter tests live in the workspace test package and import this private application's `src/human` modules through its workspace dependency. They construct an in-memory DOM or renderer port without starting a browser. `viewport` owns scene publication, disposal, lighting and frame state; `workerPort` adapts browser messages and `workerHandler` owns parsing, construction and export failure replies. Manual frame completion applies the current clay and orbit state before drawing, just as the animation loop does. Actual GPU captures remain a separate visual check.

## Other pages

- `index.html`: procedural blockman proportions, joint poses and the built-in wave clip.
- `drivers.html`: three-joint arm, two-bone IK and driver resolution.
- `stickman.html`: stickman/humanoid and cat clips.
- `gesture.html`, `showcase.html`: engine gesture/action vocabulary.
- `film.html`: script/stage/block/perform/cut pipeline output.
- `launch.html`, `impact.html`, `attach.html`, `trampoline.html`: projectile, impact, attachment and jump actions.
- `knight.html`, `archery.html`, `spar.html`: mounted, archery and boxing scenes.
- `body.html`, `mhhead.html`, `mhfull.html`: retained body and MakeHuman research surfaces, independent from the human face editor.

## Motion assets

Hand-authored libraries remain in `src/stickman-motion.ts` (including walk/run, wave, dance and shadowbox), `src/horse-motion.ts` (gaits, turns and rear), `src/cat-motion.ts` (gaits, leap, sit, stretch and tail flick) and `src/spar.ts` (the boxing exchange).

Engine-generated motion is exercised by `attach-view.ts`, `launch-view.ts`, `impact-view.ts`, `trampoline-view.ts`, `gesture-view.ts`, `showcase-view.ts` and `film-view.ts`. Model/rig build scripts under `scripts/` produce the GLB scaffolds; `scripts/mh/` retains separate MakeHuman research utilities.

Locomotion migration prioritizes humanoid walk/run/stroll/sprint, horse walk/trot/gallop/travel and cat walk/prowl. Non-gait gestures remain hand-authored until their own action/profile contract exists. A profile-generated replacement first needs regression checks against the existing observable behavior and playground captures for silhouette and timing.
