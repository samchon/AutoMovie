---
name: viewer-verification
description: Defines how to drive the viewer/playground through the Playwright library to inspect renders, poses, and motion against expectation, including how to reach a real GPU context and how to compare against previous behavior without disturbing a shared checkout. Use before claiming a viewer, render, pose, motion, or expression change works.
---

# Viewer Verification

Unit tests pin the engine's numbers; they cannot tell you the character renders right. Any change to `viewer`, to the render path, or to a pose/motion/expression that is meant to look a certain way is verified visually by driving the viewer in a real browser, not by a green test run alone.

## When to verify visually

- A `@automovie/viewer` change (model/scene builder, pose application, material, camera, lights, the player loop).
- A new or changed pose, motion clip, or expression whose correctness is "it looks like X".
- A render-output or headless-snapshot change.
- Before reporting any of the above as working.

## Driving the browser

Playwright is a **library** here, not an MCP server. Nothing registers a Playwright MCP server, so an agent that goes looking for one finds nothing and concludes it cannot verify visually. It can. The library lives in `test/node_modules/playwright` and the browser binaries are already installed under the user's `ms-playwright` cache; neither needs an install step.

Two details decide whether the frame is real.

- **Import by absolute file URL.** The library resolves only from `test/`, so a script written to a scratchpad cannot find it by name. `NODE_PATH` is ignored under ESM. Import `test/node_modules/playwright/index.mjs` by its full `file:///` URL instead.
- **Ask for `channel: "chromium"`.** The default launch drops to `chromium_headless_shell`, which has no GPU. With the real channel this repository reaches a real device through ANGLE. **Log the `RENDERER` string on every run.** Silently falling back to a software rasterizer and reading the result as a GPU frame is this procedure's main way of lying to you.

## Getting engine code into the page

Do not stand up vite or a bundler. Split it in two, which is both simpler and more robust:

1. A Node step run through `test/node_modules/.bin/tsx` imports the engine **source file by absolute path**, builds the geometry or pose, and dumps the result to JSON. `tsx` does not type-check, so another owner's type error cannot hold your verification hostage, and importing the module directly instead of through the package barrel sidesteps the empty-barrel trap an `evidence/graph` error sets.
2. A dependency-free static page reads that JSON and draws it. It opens over `file://`, so no server is involved.

Create the context with `preserveDrawingBuffer: true` and call `gl.finish()` at the end of the render, or the screenshot and the pixel read will disagree about which frame they saw. Screenshot the canvas element rather than the page, and expose `gl.readPixels` on `window` when a claim needs coordinates and channel values rather than an impression.

## Flow

1. Build the page that shows the thing: the playground or website page that mounts `mountViewer`, or a minimal page that builds a model and applies the pose.
2. **Render a calibration frame first.** Put a reference shape whose coordinates you typed by hand — untouched by the code under test — beside the subject, and fix the reading convention on it. Without that, every later reading is circular: you are using the thing you are testing to decide what its own output means.
3. Load the page, set the model and the pose or motion, advance the player to the target time, and capture.
4. Read the capture against the intended result: the bones bend the right way, the limbs sit where forward kinematics says, the expression shows the named emotion, the camera frames the subject, materials and lighting are sane.
5. For motion, sample several timestamps (start, midpoints, end) and confirm the in-betweens are coherent, not just the keyframes.
6. Report concrete observations tagged `[regression]` / `[polish]` / `[nit]` / `[ok]`. Fix obvious visual breaks in the same turn before continuing.

## Comparing against the previous behavior

Never `git stash` or check out an older commit to get the "before" frame. A shared checkout usually carries other people's uncommitted work, and that move destroys it.

Reflect the quantity under test in code instead and render the twin beside the fix. A mirrored-UV twin proved the atlas handedness fix without touching a single tracked file, and it doubles as a check on the instrument: a measurement that reports the same verdict for both the fix and its mirror is not reading what it claims to read.

## Cross-check against the engine

A render that disagrees with `resolvePose`/`sampleMotion` output is a viewer bug; a render that agrees but still looks wrong is an engine or data bug. State which side the discrepancy is on. The viewer is a thin projection of the engine's deterministic result, so the two must match.
