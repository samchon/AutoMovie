# `captureFrame` Contract

Read this guide before `captureFrame`. The tool produces actual current PNG evidence through the host capture adapter; it does not preview hypothetical source, grade composition, or make stale pixels current.

## Request

Choose exactly one compiler-registry target:

- A shot names `kind: "shot"`, an explicit `productionId`, registry `id`, non-negative shot-local `time`, and optional pass.
- An asset turntable names `kind: "asset"`, registry `id`, azimuth `angleDeg`, optional elevation, `rest` or `rom-extremes` pose, and optional pass. Production may be omitted only when the host has an unambiguous default.
- Width and height are optional positive integers bounded by production resolution. Omission requests production dimensions.

Use `beauty` to judge appearance. Use structural passes such as `pose`, `depth`, `normal`, or `segmentation` when the target, acceptance scenario, or repaint workflow needs them. A structural pass is evidence about geometry, not a substitute for beauty.

## Success evidence

`captured:true` means the target resolved through the current compiler registry, the host returned a decodable PNG, raster and snapped time matched the request, and the bytes reopened through an atomic render manifest. Check all of:

- `reviewTarget` identifies the asset or shot whose evidence changed.
- `receipt.compileFingerprint` and `receipt.targetFingerprint` bind compiler and target state.
- `receipt.rendererIdentity`, `bundle`, and `outputDigest` bind runtime and pixels.
- `frame.digest` equals the receipt output digest and the frame includes path, pass, dimensions, index, and snapped time.

Only that exact receipt-backed frame may be cited in review. Never cite a console screenshot, a guessed output path, or a previous bundle.

## Refusal catalog

- Production invalid or unregistered: choose a trimmed registered namespace; do not retry with filesystem paths.
- Registry unavailable or target missing: correct source/design and run the ordinary compile command.
- Host refusal: repair the configured capture runtime using the scaffold doctor command.
- Receipt invalid: discard the pixels. The host, compiler state, or manifest changed during capture; retry after the repository is stable.
- `captured:false`: read every returned diagnostic, correct its owner, and repeat the same target. It is never partial evidence.

After sufficient views exist, read the target-specific review guide and call `prepareReview`.
