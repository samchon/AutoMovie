# Live viewing while authoring

Keep one viewer running while changing source. Select the mode by what exists: `npm run viewer` for compiler-owned output, or `npm run viewer:preview` for an explicitly uncompiled working view. Both start Vite on loopback and print their local address. Add `-- --port <port>` when choosing a fixed port.

## Compiled output

`npm run viewer` starts a fresh `ttsx` execution of `scripts/compile.ts`, then repeats it when authored source, design documents, assets, scripts, viewer code, root configuration, or the tracked AutoMovie design and derivation inputs change. Saves are coalesced and compiler executions are serial. An edit during a run queues another run; the intermediate result is not served as current. Generated output, renders, capture state, receipts, logs, reports, caches, and `.wiki` scratch work do not trigger that loop. Restart the server after changing installed dependencies or inputs outside the project root.

The page hides its previous frame while compilation runs or refuses. Compiler artifact routes return 503 until the latest run succeeds, and the page reloads only when that admitted generation is ready. A plain Vite frontend reload would not execute Node authoring source; the separate `ttsx` invocation is what produces fresh artifacts through the normal compiler and its ownership checks. A compile refusal remains a refusal, with its diagnostic visible in the terminal and page. Correct the earliest authored input named by that diagnostic.

The compiler does not run the design emitter for you. [Compilation](../source-authoring/compilation.md) owns when reviewed design changes require `npm run design`; the viewer reports the resulting refusal until the production has valid derived design inputs. Existing shot, asset, flight, and subject routes retain their meanings. [Inspection](inspection.md) owns those routes and their evidence boundary.

## Current source before publication

`npm run viewer:preview` opens `/viewer/preview.html`. Author `viewer/preview.ts` to export `createPreview()`, returning an `IAutoMovieSourcePreview` from `viewer/src/sourcePreview.ts`. An asynchronous factory is also accepted. Import the production's actual source modules and build their result through `@automovie/viewer`; share the same geometry producer with other views. Do not copy geometry into the preview or write an imitation compiler artifact.

The result carries a Three.js `scene`, a perspective `camera`, an optional orbit `target`, and an optional `update(elapsed, camera, viewportHeight)` callback for authored animation or camera-dependent population resolution. Return the scene and camera without mounting a renderer or installing a capture hook: the page owns rendering, orbit, pan, zoom, and free movement. Mouse drag orbits, right drag pans, and the wheel zooms. W A S D moves, Space and C rise and descend, Q and E adjust speed, and Shift moves faster.

Use the optional synchronous `configureRenderer(renderer)` callback to apply production-owned render settings. The page calls it once after mounting the renderer and before its first frame.

Vite transpiles and executes the browser import graph directly. Saving an imported source module reloads that graph, so a source change reaches the scene without a generated JSON intermediary. This mode performs no TypeScript checking, compiler-plugin transformation, or production compilation. Use browser-compatible source here; Node-only imports and calls requiring compiler plugins belong to the compiled route. A syntax or runtime error hides the working frame and reports the failure; saving a correction or refreshing loads the current source again. Losing the server connection also hides the frame, and reconnecting reloads current source. Movement keys yield to focused form controls and editable text.

This mode runs no production compile watcher and mounts no generated-artifact middleware, so saving an unfinished source does not repeatedly attempt production admission. `npm run viewer` remains the path that executes fresh `ttsx`, including the project's type checking and plugins, before making current production output available.

This page is labeled SOURCE PREVIEW and installs no `window.__automovieCapture` hook. It writes no artifact, receipt, or verdict and cannot complete a review or delivery gate. Use it to see an unfinished design and steer source changes, then follow [Capture](capture.md) and [Production review](review.md) for evidence from admitted output.
