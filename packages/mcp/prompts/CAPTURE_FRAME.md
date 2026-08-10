# `captureFrame` Contract

Read this guide before `captureFrame`. The tool produces actual current PNG evidence through the host capture adapter; it does not preview hypothetical source, grade composition, or make stale pixels current.

## Request

Choose exactly one compiler-registry target:

- A shot names `kind: "shot"`, an explicit `productionId`, registry `id`, non-negative shot-local `time`, and optional pass.
- An asset turntable names `kind: "asset"`, registry `id`, azimuth `angleDeg`, optional elevation, `rest` or `rom-extremes` pose, and optional pass. Production may be omitted only when the host has an unambiguous default.
- Width and height are optional positive integers bounded by production resolution. Omission requests production dimensions, which is what review needs: a frame captured at any smaller raster is downgraded with `render-frame-invalid` and can never discharge a required view. Override them only for a cheap diagnostic look you do not intend to cite.

Use `beauty` to judge appearance. Use structural passes such as `pose`, `depth`, `normal`, or `segmentation` when the target, acceptance scenario, or repaint workflow needs them. A structural pass is evidence about geometry, not a substitute for beauty. Structural passes also suspend the scene's atmosphere, image lighting, exposure, and tone mapping, so a declared fog or environment will not appear in one; judge those from beauty.

Know what a `segmentation` frame separates before you cite it. The packaged pass colours top-level scene children by their position in the scene, so a whole building reads as one colour and inserting an unrelated node repaints everything after it: read coverage, silhouette, and occlusion from it, never stable identity. A stable palette exists beside it, derived from the compiled design with `deriveAutoMovieSemanticMask` and painted by `applyAutoMovieSemanticMask` in the viewer package. It keys every colour to a semantic id rather than to scene order, so a wall, the opening cut through it, the leaf filling that opening, and one repeated instanced slot are four exact colours that survive a rebuild in a different order, `#000000` stays reserved for background, and slots it could not address are counted rather than approximated. Drive that from your own viewer harness when a criterion needs per-entity identity, and do not read identity out of a mask that was not painted with it.

## Success evidence

`captured:true` means the target resolved through the current compiler registry, the host returned a decodable PNG, raster and snapped time matched the request, and the bytes reopened through an atomic render manifest. Check all of:

- `reviewTarget` identifies the asset or shot whose evidence changed.
- `receipt.compileFingerprint` and `receipt.targetFingerprint` bind compiler and target state.
- `receipt.rendererIdentity`, `bundle`, and `outputDigest` bind runtime and pixels.
- `frame.digest` equals the receipt output digest and the frame includes path, pass, dimensions, index, and snapped time.

Only that exact receipt-backed frame may be cited in review. Never cite a console screenshot, a guessed output path, or a previous bundle.

## Refusal catalog

Refusals arrive in two shapes and only one of them carries diagnostics. A refusal the tool can attribute to your target returns `captured:false` with its diagnostics in the payload; the catalog below lists those. A refusal of the call itself is thrown and reaches you as an MCP error text block with no payload at all: missing guide credit, `"captureFrame requires a current source compile"`, `"captureFrame requires a production frame format"`, and a commit-lock failure while the render bundle is written. `prepareReview` and `submitReview` also throw every production-resolution failure that `captureFrame` reports as a diagnostic. An error block means nothing was attempted and nothing was measured, so read its prose and satisfy the named precondition instead of hunting for a diagnostic list that does not exist.

- Production invalid or unregistered: choose a trimmed registered namespace; do not retry with filesystem paths.
- Registry unavailable or target missing: correct source/design and run the ordinary compile command.
- Host refusal: repair the configured capture runtime using the scaffold doctor command.
- Receipt invalid: discard the pixels. The host, compiler state, or manifest changed during capture; retry after the repository is stable.
- `captured:false`: read every returned diagnostic, correct its owner, and repeat the same target. It is never partial evidence.

After sufficient views exist, read the target-specific review guide and call `prepareReview`.
