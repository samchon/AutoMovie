# `captureFrame` Contract

Read this guide before `captureFrame`. The tool produces actual current PNG evidence through the host capture adapter; it does not preview hypothetical source, grade composition, or make stale pixels current.

## Request deadline

A registered the script surface channel uses the request deadline its host manages. An author-created TypeScript SDK client is a separate client and does not inherit that host setting. If you deliberately create one, the request deadline belongs to that client, not the AutoMovie server, and the server cannot raise it for you.

`captureFrame` and `captureTurntable` are synchronous evidence calls, and either may legitimately take longer than the SDK's 60,000 ms default. Pass at least `300_000` ms as the third `callTool` argument for either tool. An the script surface error with code `-32001` and `data.timeout: 60000` reports the client's deadline, not an AutoMovie capture diagnostic, so correct the client option before retrying instead of diagnosing the capture pipeline from that timeout alone.

```ts
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const callCaptureTool = (
  client: Client,
  name: "captureFrame" | "captureTurntable",
  args: Record<string, unknown>,
) =>
  client.callTool(
    { name, arguments: args },
    CallToolResultSchema,
    { timeout: 300_000 },
  );
```

## Request

Choose exactly one compiler-registry target, and the choice is between these two:

- A shot names `kind: "shot"`, an explicit `productionId`, registry `id`, non-negative shot-local `time` no greater than the shot's duration, and optional pass. The returned time is snapped to the nearest frame index on the production clock.
- An asset turntable names `kind: "asset"`, registry `id`, azimuth `angleDeg` in `[0, 360)`, optional elevation in `[-85, 85]`, `rest` or `rom-extremes` pose, optional `part`, and optional pass. A turntable runs on a fixed twelve-second clock where time is `angleDeg / 30`, so an azimuth is one exact frame index. Production may be omitted only when the host has an unambiguous default. `rom-extremes` is available only for a model whose compiled form carries a skeleton, so a prop, a panel, or a building part is captured in `rest`.
- `part` names one compiled part id of that model and frames the turntable on it. The scene is still the whole model, so the piece is seen in the context that gives its proportions meaning; what narrows is the camera. Use it when the thing you must judge is a few dozen pixels of a whole-model view: a mullion, a hinge, a hand. A part id the compiled model does not carry is refused with the ids it does carry, and imported geometry is refused outright because this surface does not address its interior nodes. A part view is a diagnostic look and never discharges a required asset review view, since what that review judges is the whole silhouette.
- Width and height are optional positive integers bounded by production resolution. Omission requests production dimensions, which is what review needs: a frame captured at any smaller raster is downgraded with `render-frame-invalid` and can never discharge a required view. Override them only for a cheap diagnostic look you do not intend to cite.

Nothing else is a capture target here. Beyond an isolated model's own `part`, this tool has no subject, space, element, or instance target and no way to ask it for an arbitrary pose of a placed thing: through `captureFrame`, a compiled subject that a shot stages is reached only inside that shot, framed by that shot's camera. When the question is what a compiled subject is, where it stands, what its bounds are, or what changed between revisions, read `SUBJECT_INSPECTION`. That route is an ordinary engine query in a project `scripts/` module over the compiled artifact and needs no pixels at all, which is usually the cheaper answer for a building or an interior.

Use `beauty` to judge appearance. Use structural passes when the target, acceptance scenario, or repaint workflow needs them. The pass names are a closed set and `segmentation` is not one of them: ask for `depth`, `mask`, `normal`, `outline`, or `pose`, and expect a refusal for anything else. A structural pass is evidence about geometry, not a substitute for beauty. Structural passes also suspend the scene's atmosphere, image lighting, exposure, and tone mapping, so a declared fog or environment will not appear in one; judge those from beauty.

Know what a `mask` frame separates before you cite it. A SHOT target paints the stable semantic palette: the page derives it from the same compiled artifact it draws, with `autoMovieRenderSubjectOfCompiledShot` and `deriveAutoMovieSemanticMask`, so a wall, the opening cut through it, the leaf filling that opening, and one repeated instanced slot are four exact colours that survive a rebuild in a different order. `#000000` stays reserved for background, a mesh no entry claims is painted that background rather than left showing its lit material, and slots the bounded palette could not address are counted rather than approximated. An ASSET turntable has no compiled design and keeps the legacy ramp, which colours top-level scene children by their position: read coverage, silhouette, and occlusion from that one, never identity.

A colour means nothing without the document that names it. The palette is the sidecar, `renderAutoMovieSemanticMaskSidecar` is its exact bytes, and every entry carries the semantic id, its kind and label, and the `owner` chain that resolves a door leaf to its opening, its wall boundary, its room, and its building unit. Derive it from the same compiled shot you captured, never from a design that has moved on since; the capture receipt does not carry it for you yet, so a mask frame you cite for identity travels with a palette you derived and stored yourself.

## The whole asset turntable in one call

`captureTurntable` takes `{ asset, productionId?, width?, height? }` and captures the complete view set an asset review is judged from: the four horizontal quarters at fifteen degrees, the steep `outline` pass overhead, and a rigged model's `rom-extremes` pose. The set belongs to the review contract rather than to the request, which is the point of the tool. An asset covered from the angles its author chose is an asset whose back nobody looked at.

Every view runs through the same path `captureFrame` uses, so each one carries the same receipt and the same refusals. What comes back is a ledger, not six receipts: `views` lists every required view in canonical order with the project-relative `frame` it committed, or `null` where that view was refused, and `captured` is true only when every one of them committed. A refused view is named by the diagnostic whose target reads `<asset>#<view id>`.

Use `captureFrame` for one view you want for a specific question. Use `captureTurntable` when what you owe is an asset review.

## Success evidence

`captured:true` means the target resolved through the current compiler registry, the host returned a decodable PNG, raster and snapped time matched the request, and the bytes reopened through an atomic render manifest. Check all of:

- `reviewTarget` identifies the asset or shot whose evidence changed.
- `receipt.compileFingerprint` and `receipt.targetFingerprint` bind compiler and target state.
- `receipt.rendererIdentity`, `bundle`, and `outputDigest` bind runtime and pixels.
- `frame.digest` equals the receipt output digest and the frame includes path, pass, dimensions, index, and snapped time.

Only that exact receipt-backed frame may be cited in review. Never cite a console screenshot, a guessed output path, or a previous bundle.

## Refusal catalog

Refusals arrive in two shapes and only one of them carries diagnostics. A refusal the tool can attribute to your target returns `captured:false` with its diagnostics in the payload; the catalog below lists those. A refusal of the call itself is thrown and reaches you as an the script surface error text block with no payload at all: missing guide credit, `"captureFrame requires a current source compile"`, `"captureFrame requires a production frame format"`, and a commit-lock failure while the render bundle is written. the evidence citation and the evidence citation also throw every production-resolution failure that `captureFrame` reports as a diagnostic. An error block means nothing was attempted and nothing was measured, so read its prose and satisfy the named precondition instead of hunting for a diagnostic list that does not exist.

- Production invalid or unregistered: choose a trimmed registered namespace; do not retry with filesystem paths.
- Registry unavailable or target missing: correct source/design and run the ordinary compile command.
- Compile not current: `generated-stale` and `compile-current-invalid` say the generated output is not a clean build of current source. Compile before asking for pixels; every capture is bound to the compile it came from.
- Target absent from compiled output: `preview-target-missing` is not the same refusal as an unregistered target. The registry knows the name and the compiler published nothing for it.
- Input out of range: `preview-input-invalid` covers a shot time past the shot's duration, an asset azimuth or elevation outside its interval, a raster larger than the production frame, and `rom-extremes` asked of a model with no skeleton. Correct the request rather than the project.
- Host refusal: repair the configured capture runtime using the scaffold doctor command.
- Receipt invalid: discard the pixels. The host, compiler state, or manifest changed during capture; retry after the repository is stable.
- `captured:false`: read every returned diagnostic, correct its owner, and repeat the same target. It is never partial evidence.

Which views are enough is not yours to decide. A shot owes every frame-and-pass pair its contract's `reviewFrames` declare; an asset owes the fixed turntable set, which is exactly what `captureTurntable` captures. Read the review this target owes or the review this target owes, call the evidence citation, and let its `review-evidence-missing` diagnostics name the exact production, target, time, and pass still owed.
