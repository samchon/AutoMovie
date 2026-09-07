# Reference subjects

These are directly authored AutoMovie model studies. They use `@automovie/interface` model/mesh types and general `@automovie/engine` geometry operations. They do not use `@automovie/face`, and they are not a shared `human` parameter module.

The current subject, `generated-korean-girl-01`, is unfinished. Its [inspection record](generated-korean-girl-01/review.md) explicitly does not accept the likeness. Hair and torso are deferred. The source photograph is `.shots/input/east-asian/generated-korean-girl-01/generated-korean-girl-age-16.png`; the compiled model does not need that file or the measurement software at runtime.

## Construction

| Source | Responsibility |
| --- | --- |
| `generated-korean-girl-01/controlNet.ts` | Frozen image measurements, estimated depth, normalization and provenance |
| `generated-korean-girl-01/configuration.ts` | Subject-owned sockets, numerical component dimensions and the assembly used by export |
| `generated-korean-girl-01/model.ts` | Assemble the independently inspectable anatomical builders |
| `generated-korean-girl-01/head.ts` | Join facial openings, nasal lining, lid margins and the inferred cranium before subdivision |
| `generated-korean-girl-01/eyes.ts` | Shared lid boundary, fold, sclera, gaze intersection, iris, lashes and brows |
| `generated-korean-girl-01/nose.ts` | Provisional alar/tip depth and geometric nasal cavities |
| `generated-korean-girl-01/mouth.ts` | Replaceable lips, shared boundary topology, oral cavity and individual dental crowns |
| `generated-korean-girl-01/dentalArc.ts` | Metric dental placement along the horizontal arch, with inferred posterior continuations |
| `portraitEyeSphere.ts` | Socket-oriented spherical curvature and camera-ray contact fitting, independent of gaze |
| `portraitCornea.ts` | Closed transparent optical shell with independently controlled curvature and axial thickness |
| `generated-korean-girl-01/ears.ts` | Inferred helix, antihelix, concha and pinna attachment |
| `generated-korean-girl-01/cranium.ts` | Shared cranial continuation, posterior cap and cropped neck; hidden anatomy is inferred |
| `portraitComponents.ts` | Fit, shared attachment and refined-interior protocol for replaceable parts |
| `blendPortraitSkin.ts` and `portraitSkinTopology.ts` | Geodesic skin adaptation and explicit opening/stitch validation |
| `portraitSurface.ts` | Optional deformation layers on the refined skin; no cheek or fold layer is configured yet |
| `geometry.ts` and `subdivideControlMesh.ts` | Sampling, interpolation, subdivision, shared normals and metric conversion |
| `portraitDocument.ts` | Static GLTF conversion preserving resident buffers and supported material factors |
| `captureProfile.ts` | Fixed camera, crop and area-light conditions for inspection |

Construction coordinates are millimetres, with +Y up and +Z in front of the face. Anatomical left is +X. `portraitPart` is the single conversion to the interface's metres. Skin, lips and nasal lining share the same refined cage and normal field; material regions retain only their referenced vertices. Eye geometry reads the refined lid boundary, so it cannot independently invent a second aperture.

Read `configuration.ts`, `model.ts`, then `head.ts` to follow the running assembly. `controlNet.ts` preserves observed landmark identities; individual component files define what their controls mean. Keep subject-specific vertex IDs in socket bindings. Measurements, inferred anatomy and authored control values have different confidence and must remain distinguishable.

The image supplies image-plane landmarks. Depth, rear skull and occluded anatomy remain estimates. See [measurement provenance and attribution](generated-korean-girl-01/NOTICE.md). No source photograph is projected onto the model as a texture.

The corneal curvature radius of 7.8 mm, axial thickness of 0.55 mm and refractive index of 1.376 are schematic rendering assumptions from the [eye-model table](https://pmc.ncbi.nlm.nih.gov/articles/PMC4646557/), not measurements of this subject. The fitted globe and clipped corneal shell approximate the visible eye; optical parameters do not establish physiological accuracy.

## Replace an anatomical component

The face assembler depends on `IPortraitComponent`, with one instance for each eye, one for the nose and one for the mouth. The subject's `configuration.ts` supplies socket identities and numerical dimensions. Component implementations receive those bindings instead of embedding landmark IDs.

A fitted part supplies exact skin constraints and original triangle ordinals to remove. `blendPortraitSkin` adapts neighbouring skin within each declared geodesic reach. Shared attachment vertices connect the part to that skin. `portraitSkinTopology` refuses undeclared openings and incompatible stitches before subdivision. Each component then finishes its interior geometry against the actual refined rim.

The order is part of the attachment contract:

1. Fit every component against the same original host. Collect exact constraints before adapting any skin.
2. Blend the surrounding skin, remove the declared original triangle ordinals, and attach each component using shared vertex identities.
3. Join the cranium and neck, validate declared openings, and subdivide the complete cage once.
4. Evaluate optional surface layers against the same refined host. Their engine fields use metres; the adapter returns millimetres and fades displacement at open rims.
5. Recompute common normals, split material regions, and build component interiors against the final refined boundary. Attach ears by sampling that actual head surface.

The surface-layer hook is available, but the current `portraitAssembly` supplies no layers. Separate cheek compartments, nasolabial folds, tear troughs and perioral masses remain implementation work. The ear roots are embedded separate shells; they are not welded to the skin.

This prototype currently exposes replaceable procedural eyes, noses and mouths. Ears, cranium and neck remain subject builders. Numerical controls do not establish anatomical correctness.

```ts
import {
  alternatePortraitEye,
  alternatePortraitNose,
  portraitComponentsFor,
  portraitEyeShape,
} from "./generated-korean-girl-01/configuration";
import { buildReferencePortrait } from "./generated-korean-girl-01/model";

const model = buildReferencePortrait({
  components: portraitComponentsFor(
    portraitEyeShape,       // anatomical right eye
    alternatePortraitEye,  // independently replaced left eye
    alternatePortraitNose,
  ),
  subdivisionRounds: 3,
});
```

Eye controls include aperture width/opening, outer-corner lift, orbital depth, lid fold, iris/pupil radius and spherical surface curvature. Nose controls include overall width, tip/alar projection, aperture dimensions, aperture rise/tilt and cavity dimensions. Mouth controls include width, opening, corner elevation, upper/lower lip projection, individual crown dimensions, dental-row placement and tooth spacing. Tessellation is explicit. Factories copy their inputs, so editing one preset does not mutate an existing component. A fourth argument to `portraitComponentsFor` replaces the mouth shape; omission selects this subject's current smile.

See the [inspection record](generated-korean-girl-01/review.md#component-replacement) for the current numerical checks and pending replacement renders.

## Export a GLTF

Run the tracked exporter from the repository root after installing the workspace dependencies. The exporter uses repository-relative output paths and writes staging artifacts in `.shots/face-experiment/`; export alone does not replace the published `preview/` bundle.

```powershell
./test/node_modules/.bin/tsx.cmd test/scripts/face-review/export.ts
```

The GLB is self-contained. The JSON GLTF uses its sibling `portrait.bin`. `portraitDocument` preserves metallic/roughness colour, emission, alpha mode, sidedness and the supported scalar transmission, IOR, volume and clearcoat extensions. Every GLTF reader or writer must register `portraitGltfExtensions`; an unregistered SDK writer can discard extension data. The converter refuses rigs and texture assets. Positive material thickness requires a closed manifold mesh.

## Inspect and revise

`test/lint.config.ts` connects the model to every H2 view in its inspection record and connects `review.ts` to the complete construction export population. TypeScript evidence uses type-only imports and `{@link ...}` targets. A changed referenced declaration invalidates its `@evidenceReview` fingerprint. New source enters either its declared subject or the shared residual population.

The model review graph reports warnings. Rendering precedes visual review, so missing or expired review evidence must allow the authoring entrypoint to run under `ttsx`. A warning remains an outstanding inspection obligation; it does not accept the model's appearance.

Before changing geometry or an appearance dependency, remove the affected review companions. Build a new GLTF, freeze its bytes and capture profile, and inspect front, both obliques, both profiles, back, reference pose and clay. Compare visible feature boundaries against the original image. Write the observed failures as well as the successes, then write new review companions. A compiler-provided fingerprint is not a visual review, and a green graph is not an acceptance of likeness.

Run `test/scripts/face-review/preview.ps1` from PowerShell to export and publish the latest complete bundle. The script requires the installed workspace, Chromium and Blender 5.1 at its declared local path. It publishes `.shots/face-experiment/preview` only after export, all eleven Cycles captures and comparison verification finish. The bundle includes `portrait.glb`, JSON GLTF/buffer, `comparison.png`, `views.png`, `clay-views.png`, camera/light profile and hashes. Previous and incomplete capture directories are recycled instead of accumulating numbered rounds. A failed export or render leaves the previous complete preview available.

```powershell
./test/scripts/face-review/preview.ps1
```

The Blender executable is `C:/Program Files/Blender Foundation/Blender 5.1/blender.exe`. The comparison step uses the Playwright Chromium installation available to `test`; install that browser with `pnpm --filter @automovie/test exec playwright install chromium` if it is absent. Progress and process failures are written to `.shots/face-experiment/preview.log`. The publisher owns an exclusive `preview.lock`; wait for its process to finish before starting another capture.

`comparison.png` places the source photograph beside an actual GLTF render. `reference.png` is also a render, in the estimated source-camera pose. `views.png` contains six yaw views and `clay-views.png` contains three views without the colour finishes. The receipts inside `preview/` identify the exact model, configuration, profile and frame bytes. Read those files for artifact identity; a source edit may be newer than the last successfully published capture.

The review points to the fixed preview path and records the exact inspected GLB digest. A new preview does not automatically renew that review or its evidence comments. Renderer differences must not be credited as geometry improvements. Import-only changes, private module state and external renderer-script changes also require a new manual inspection even when a public-declaration fingerprint does not change.

Run `pnpm --filter @automovie/test build` for the graph/type check and `pnpm --filter @automovie/test start --include test_subject_` for the pure unit scenarios. Those tests check geometry, assembly and export behavior. Likeness is judged from the frames.
