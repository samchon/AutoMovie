# Live viewing while authoring

Keep `npm run viewer` running while changing source. It starts the source viewer on loopback and prints its local address. Add `-- --port <port>` when choosing a fixed port. The HTML entry is `public/index.html`; executable viewer and producer code stays under `src`.

The viewer compiles current source and serves the successful emitted generation from memory. It does not run a production-store builder or write generated scene state. Source and imported assets are inputs; generated output and cache changes must not trigger an authoring loop.

## Production-owned preview

`npm run viewer` opens the source preview. Author `src/createPreview.ts` to export `createPreview()`, returning an `IAutoMovieSourcePreview` from `src/viewer/sourcePreview.ts`. An asynchronous factory is also accepted. Import the production's actual source modules and build their result through `@automovie/viewer`; share the same geometry producer with other views. Do not copy geometry into the preview or write an imitation builder artifact.

The result carries a Three.js `scene`, a perspective `camera`, an optional aim `target`, and an optional `update(elapsed, camera, viewportHeight)` callback for authored animation or camera-dependent population resolution. Return the scene and camera without mounting a renderer or installing a capture hook. The page supplies first-person flight controls: click the canvas to acquire mouse look, use W A S D or arrows to fly, Space and C to rise and descend in world height, Q and E to adjust speed, and Shift to move faster. Mouse look rotates the eye in place; the wheel changes field of view. Esc releases the pointer and stops movement so form controls can be used.

An authored view selector may update the same camera and target. The next input uses that actual pose; it cannot restore angles from the previously selected view. During flight the optional shared target follows the eye's viewing direction, including for a producer-owned inspection light. Pointer-lock refusal is reported as an input state with a click-to-retry message. Compiler failure, reload, or page closure releases pointer lock, clears movement keys, detaches input listeners, and stops the renderer.

Use the optional synchronous `configureRenderer(renderer)` callback to apply production-owned render settings. The page calls it once after mounting the renderer and before its first frame.

The preview compiler uses the project's compiler settings in `package.json`. TypeScript checking and plugins remain active; do not create a separate preview configuration file. Supply accurate source types when a diagnostic requires them; a declaration file standing in for a JavaScript producer cannot supply its runtime output. Browser-compatible source reaches no Node built-in through any import: take identity, sampling, and geometry calculations from `@automovie/engine` and `@automovie/viewer`, and keep Node-only production or render modules out of its runtime import graph. A type-only import is erased and stays safe.

Each change runs a fresh builder worker. Saves are coalesced and runs are serial; a save during a run discards its intermediate result and queues the next. Vite serves the successful emitted JavaScript map under one generation identity, propagates that identity through local imports, and refuses missing, failed, or superseded modules. It does not check one source and then transpile another copy. A small diagnostic shell stays available through builder errors and contains no scene producer. A syntax, type, plugin, or runtime error hides the working frame; correction loads the new compiled generation. Losing the server connection also hides the frame, and reconnecting reloads current source. Movement keys yield to focused form controls and editable text.

The scene module executed by the browser is the successful compiler output for the current generation. The viewer supplies no separate film publication path.

This page is labeled SOURCE PREVIEW and installs no delivery-capture hook. It writes no artifact or verdict. Use it to inspect the production's own source, then follow [Capture](capture.md) and [Production review](review.md) to establish and record the exact observations the work requires.
