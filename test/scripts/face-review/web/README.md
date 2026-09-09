# Direct face web workbench

This test utility displays the actual named meshes in an exported `model.json`. It has no model editor or dependency on `@automovie/face`. It accepts static, untransformed mesh parts from the current direct study. A future geometry producer can reuse the inspection controls by supplying the same export contract.

From the repository root:

```powershell
node test/scripts/face-review/web/server.mjs
```

Open `http://127.0.0.1:8766`, or launch a visible Playwright Chromium window:

```powershell
node test/scripts/face-review/web/open.mjs
```

The first server argument is the port and the second is the source artifact directory. Sources must resolve inside `.shots/face-experiment`. Independent ports allow comparison of frozen exports:

```powershell
node test/scripts/face-review/web/server.mjs 8767 .shots/face-experiment/preview
$env:FACE_WEB_PORT = "8767"
node test/scripts/face-review/web/open.mjs
```

The server binds only `127.0.0.1` and serves an exact file allowlist. It uses local Three.js modules and the shared `logic.mjs` inspection helper, with no bundler. Runtime files and the reference photo are fixed when the server starts. Restart the server and refresh the page after changing viewer code. Source exports update automatically in an open page, while `Reload export` also permits an explicit refresh. Both preserve the camera, mode and surviving part visibility. The server verifies the model, GLB, profile, configuration and reference hashes against `artifact-basis.json` before accepting a reload. A mixed or incomplete export is refused while the last loaded mesh remains visible.

With the default `.shots/face-experiment` source, `watch.mjs` watches subject modules, engine/interface source, export scripts and their local configuration. Writes debounce for 500 ms and coalesce while one build runs. The wrapper invokes the installed `ttsx` launcher with `-P test/tsconfig.scripts.json test/scripts/face-review/export.ts`, preserving the existing project checks and plugins. It acquires the existing portrait publication lease while exporting and waits when another publisher owns it. A frozen source subdirectory does not trigger source rebuilds.

The HTTP process stays alive when the exporter fails. A failed `ttsx` check appears in the page with its log path under `.shots/face-web-work/ttsx-export-<session>-<generation>.log`; the last verified model remains visible. No alternative runner, plugin-disable flag or evidence waiver is applied. The page polls the artifact basis every 1.5 seconds and loads changed bytes only through the complete snapshot verification. A failed source build remains visible even if an independent publisher supplies another valid artifact. Receipts carry the observed source-build state, and a failed reload/build blocks a new capture until the failure is resolved. The optional fourth argument `--no-watch` keeps artifact polling active while suspending automatic source rebuilding during another owner's publication.

Drag to orbit, wheel to zoom and right-drag to pan. Canonical views use the exported camera profile. Eye and mouth views frame resident part bounds in the context of the whole model. The nose uses an authored orthographic close camera at target `[0, -0.010, 0.074]`, distance `0.4 m` and vertical span `0.068 m`, matching the study's `render-close.py` inspection. The basic assembly integrates nasal skin into `head` and has only `nostril-interiors` as a separate nasal part. Colour, clay and wireframe are inspection modes. Part toggles remain explicit across mode changes, including hair; use the Hair button to expose the head for a clay inspection. The filter addresses every exported part, including nasal core/join when those parts exist. It cannot isolate skin inside `head`.

`reference` reproduces `render-blender.py`'s recorded measurement rotation, image origin, millimetres per pixel and square reference crop. The model group receives that exact matrix; the orthographic camera and the photograph display the same crop. Receipts include the model matrix, projection, orthographic extents and native square raster. Returning to a canonical view clears the model rotation and restores perspective and the profile's portrait dimensions. An arbitrary orbit view is not registered to the photograph.

## Capture

```powershell
node test/scripts/face-review/web/capture.mjs round-001
node test/scripts/face-review/web/capture.mjs nose-check front,left-oblique,left-profile,nose colour,clay,wireframe
node test/scripts/face-review/web/capture.mjs comparison-round reference colour,clay
```

`FACE_WEB_PORT` selects the running server. `FACE_WEB_HEADED=1` makes an automated capture browser visible. Captures always request Playwright's `channel: "chromium"` and refuse unknown or software renderer names. Every run logs the unmasked GPU renderer and captures the independent native cube and RGB axes first. Inspect that calibration before interpreting the subject captures: front looks down −Z, +X is screen-right, +Y is screen-up, and +Z approaches the camera.

PNG files, individual JSON receipts and the completed `capture.json` are written to a new `.shots/face-web-work/<label>` directory. An existing label refuses. The capture checks exact PNG raster dimensions and unchanged camera/model/mode state across the canvas screenshot. Receipts identify the source artifact hashes, runtime bytes, Three.js revision, GPU, light setup, camera position/quaternion/target, display mode, exact visible part ids, calibration state and PNG SHA-256. An interrupted run has no completed manifest. The page's Save button downloads the same canvas PNG and its receipt through the browser; a browser may ask to permit multiple downloads.

WebGL uses declared inspection lights, ACES tone mapping and scalar optical material fields. It does not reproduce Cycles area-light integration, ray-traced shadows or AgX. Clip planes enclose the complete subject's box in camera space with a 5% diagonal margin and update on orbit, pan and zoom. Receipts record those exact clips and observed depth bits. Use this workbench for rapid geometry inspection and keep stable Blender milestones as their own renderer-specific observations.

## Automation and preview publication

`window.faceViewer.ready` resolves after the initial verified load. The hooks `reload()`, `setView(name)`, `setMode(name)`, `setVisible(partIds, visible)`, `setCalibration(visible)`, `identity()`, `capture()` and `readPixel(x, y)` operate on the currently loaded artifact. Pixel coordinates use the canvas's top-left origin. `capture()` returns `{ png, receipt }`; `prepareScreenshot()` places the native-size canvas at integer screen coordinates for a Playwright canvas-element screenshot.

`open.mjs` prints a loopback `BROWSER_CDP` endpoint (default `http://127.0.0.1:9226`, configurable with `FACE_WEB_CDP_PORT`). A second Playwright client can use `chromium.connectOverCDP(endpoint)` and `browser.contexts()[0].pages()[0]` to drive that same visible window. Disconnect the client when finished; closing its page or context closes the user's workbench.

The web utility never writes `.shots/face-experiment/preview`, its `comparison.png`, or any Blender receipt. To publish a web round, the owner of `preview.ps1` can copy a completed capture directory into its staging directory's `web/` child while holding the existing publication lease. Before copying, compare every field in the web manifest's `artifact` against the staging directory's `artifact-basis.json`. Copy both the PNGs and receipts. The same rule applies to a web comparison assembled by the publisher: its receipt must name the input web PNG hashes and their identical artifact basis. Preserve the Blender comparison and receipt as distinct outputs.
