# Reference subjects

These are directly authored AutoMovie model studies. They use `@automovie/interface` model/mesh types and general `@automovie/engine` geometry operations. They do not use `@automovie/face`, and they are not a shared `human` parameter module.

The current subject, `generated-korean-girl-01`, is unfinished. Its [inspection record](generated-korean-girl-01/review.md) explicitly does not accept the likeness. Hair is a coarse optional silhouette mass; eyebrow/hair detail and torso remain deferred. The source photograph is `.shots/input/east-asian/generated-korean-girl-01/generated-korean-girl-age-16.png`; the compiled model does not need that file or the measurement software at runtime.

## Construction

The [anatomical construction design](FACE-DESIGN.md) defines the basic/detail relationship, component and group responsibilities, complete surface replacement, review obligations and the later `human` extraction equivalence. It distinguishes demonstrated mechanisms from unresolved portrait form.

The [anatomical form and control inventory](FACE-ANATOMY.md) traces every facial region through its active owner and records absent form responsibilities, fixed internal sections, insufficient detail and controls that do not reach the model recipe. Use it before choosing another local refinement; a component name or a valid parameter does not establish sufficient shape control.

`IPortraitEyeShape.lowerLidProfile` reaches actual shared eyelid construction through `lowerLidSection.ts`. Its optional longitudinal section array separates pretarsal body, subtarsal boundary and preseptal transition while the eye owns canthal blending, final skin attachment and optical contact. The basic path remains available by omission; detailed profile admission and numerical sensitivity do not accept a portrait fit.

`createPortraitOrbitalSupport` supplies each upper orbit's forehead/brow-pad/sulcus section targets on resident skin. Its group calls the shared coupled control solver and joins `portraitAssembly.surfaceLayers`; the final eyebrow fibres follow the same changed skin. This form owner is separate from the hair profile and remains subject to the portrait's visual acceptance.

`IPortraitNoseShape.depthScale` uses the subject's `supportPlane` datums to scale projection from a shared facial basis. Exterior and aperture fitting consume it together. Omit it or use one when selecting an alternative section/body basis; stacking nonidentity complete bases refuses. The capture records both the selected nose shape and its socket, including these attachments.

The active `portraitAssembly` uses the measured component surface with a grouped upper dentition. Read `configuration.ts`, `model.ts`, `head.ts`, then `dentalComponent.ts`. The original image measurements own the facial identities; each eye/nose/mouth component supplies shared-skin attachments. The dental component supplies no skin cut and reads the final refined oral anchors after the mouth has constructed its opening. The mouth's legacy crowns are disabled in this assembly, giving dentition exactly one owner.

`measuredPortraitAssembly` selects the current subject settings with the legacy dental placement for component comparisons. It is not an immutable checkpoint: later edits to its referenced settings also change that assembly. The attributed CC0 [anatomical reference study](reference-anatomy/README.md) and recorded `fittedModel.ts` remain separate experiments. Their target fit does not establish likeness and is not the active export. No source photograph is projected onto either model as a texture.

| Source | Responsibility |
| --- | --- |
| `generated-korean-girl-01/controlNet.ts` | Frozen image measurements, estimated depth, normalization and provenance |
| `generated-korean-girl-01/configuration.ts` | Subject-owned sockets, numerical component dimensions and the assembly used by export |
| `generated-korean-girl-01/model.ts` | Assemble the independently inspectable anatomical builders |
| `generated-korean-girl-01/head.ts` | Join facial openings, nasal lining, lid margins and the inferred cranium before subdivision |
| `generated-korean-girl-01/eyes.ts` | Shared lid boundary, fold, sclera, gaze intersection, iris, lashes and brow assembly |
| `generated-korean-girl-01/ocularTissues.ts` | Medial caruncular/plica relief and lower margin sampled in the eye's final lid/globe frame |
| `generated-korean-girl-01/eyebrows.ts` | Replaceable fibre dimensions and attachment to the actual refined forehead surface |
| `generated-korean-girl-01/nose.ts` | Provisional alar/tip depth and geometric nasal cavities |
| `generated-korean-girl-01/nostrilRim.ts` | Aperture-plane dimensions and optional elliptical rim regularization |
| `generated-korean-girl-01/mouth.ts` | Replaceable lips, shared boundary topology, oral cavity and individual dental crowns |
| `generated-korean-girl-01/lipSection.ts` | Curved upper/lower band coordinates and independent body, upper tubercle and lower pad relief |
| `generated-korean-girl-01/dentalArc.ts` | Metric dental placement along the horizontal arch, with inferred posterior continuations |
| `generated-korean-girl-01/dentalCrown.ts` | Closed enamel lofts with cervical narrowing and independently shaped cutting edges |
| `generated-korean-girl-01/anatomy.ts` | Subject-owned nasal, orbital and perioral tissue supports |
| `generated-korean-girl-01/hairProxy.ts` | One connected coarse cap/frontal boundary/curtain following the current scalp and forehead, with the photograph-right ear exposed |
| `generated-korean-girl-01/cheeks.ts` | Skin-bound malar, medial/buccal cheek and mouth-corner relief, with a separately controlled nasolabial groove |
| `portraitEyeSphere.ts` | Socket-oriented spherical curvature and camera-ray contact fitting, independent of gaze |
| `portraitCornea.ts` | Closed transparent optical shell with independently controlled curvature and axial thickness |
| `portraitDirectionalContact.ts` | Directional contact against the same resident triangles used by an attached optical surface |
| `generated-korean-girl-01/ears.ts` | Inferred helix, antihelix, concha and pinna attachment |
| `generated-korean-girl-01/cranium.ts` | Shared cranial continuation, posterior cap and cropped neck; hidden anatomy is inferred |
| `portraitComponents.ts` | Fit, shared attachment and refined-interior protocol for replaceable parts |
| `blendPortraitSkin.ts` and `portraitSkinTopology.ts` | Geodesic skin adaptation and explicit opening/stitch validation |
| `portraitSurface.ts` | Compose anatomical deformation layers on refined skin while preserving its open attachment rims |
| `portraitRelief.ts` | Bind named support regions to the actual refined skin and convert their metric fields |
| `geometry.ts` and `subdivideControlMesh.ts` | Sampling, interpolation, subdivision, shared normals and metric conversion |
| `portraitDocument.ts` | Static GLTF conversion preserving resident buffers and supported material factors |
| `portraitMeshBuffers.ts` | Placement and Float32 face-preservation checks using the engine's existing transform and welded-pole policy |
| `captureProfile.ts` | Fixed camera, crop and area-light conditions for inspection |
| `portraitCaptureDiagnostic.ts` | Consumed capture-byte identity and diagnostic publication lease |

Construction coordinates are millimetres, with +Y up and +Z in front of the face. Anatomical left is +X. `portraitPart` converts completed meshes into metre-valued model parts. Transient surface-deformation commands also use engine metres; their adapter returns displacements to construction millimetres before model parts are created. Skin, lips and nasal lining share the same refined cage and normal field; material regions retain only their referenced vertices. Eye geometry reads the refined lid boundary, so it cannot independently invent a second aperture.

For the procedural assembly, read `configuration.ts`, `model.ts`, then `head.ts`. `controlNet.ts` preserves observed landmark identities; individual component files define what their controls mean. Keep subject-specific vertex IDs in socket bindings. Measurements, inferred anatomy and authored control values have different confidence and must remain distinguishable.

The image supplies image-plane landmarks. Depth, rear skull and occluded anatomy remain estimates. See [measurement provenance and attribution](generated-korean-girl-01/NOTICE.md). No source photograph is projected onto the model as a texture.

The corneal curvature radius of 7.8 mm, axial thickness of 0.55 mm and refractive index of 1.376 are schematic rendering assumptions from the [eye-model table](https://pmc.ncbi.nlm.nih.gov/articles/PMC4646557/), not measurements of this subject. The fitted globe and corneal shell approximate the visible eye; optical parameters do not establish physiological accuracy. Omitted `cornealBoundary` retains the earlier aperture clipping, while `limbus` preserves a complete circular boundary. Optional `lidContact: "cornea"` requires that full boundary and projects the shared refined eyelid region against its actual mesh using the recorded view direction and `lidThickness` clearance. This preserves projected positions but still needs contact and section inspection; a full cornea without that tissue relationship protruded through the previous lids.

The optional eye `tissues` profile supplies `cornerLength`, `caruncleProjection`, `plicaProjection`, `lowerMarginWidth` and `lowerMarginLift`, all in millimetres. A common medial patch places the plica lateral to the caruncular mound, following the [Kellogg Eye Center's external-eye anatomy](https://kellogg.umich.edu/theeyeshaveit/anatomy/external-eye.html). The eye supplies its actual refined upper/lower curves and spherical surface; neither tissue owns a second aperture. The lower margin is clipped to half the local opening and fades at the canthi. Omission disables both surfaces; zero corner length or margin width disables that surface independently. The factory copies the dimensions. The active dimensions and vascular PBR finishes are provisional authored fits, not measured anatomy or a physiological optical simulation.

## Grouped dentition

The active portrait uses three owners: `dentalCrown.ts` builds individual enamel profiles; `dentalRow.ts` composes those crowns along one local arch and gingival plane; `attachPortraitDentalRow` applies one rigid oral frame to the merged group. `dentalComponent.ts` supplies that frame from the actual refined mouth through the shared component protocol. `portraitDentalRow` owns arch half-width/depth, arc-length gap and ordered crown profiles. `portraitDentalSocket` identifies three oral anchors, while `portraitDentalPlacement` moves the whole upper row by lift and recess in millimetres. A profile edit recomputes the group; no tooth independently samples a lip landmark. These authored settings require intermediate front/profile/clay renders and do not establish anatomical or visual acceptance.

## Replace an anatomical component

The face assembler depends on `IPortraitComponent`, with one instance for each eye, one for the nose and one for the mouth. The subject's `configuration.ts` supplies socket identities and numerical dimensions. Component implementations receive those bindings instead of embedding landmark IDs.

A fitted part supplies exact skin constraints and original triangle ordinals to remove. `blendPortraitSkin` adapts neighbouring skin within each declared geodesic reach. Shared attachment vertices connect the part to that skin. `portraitSkinTopology` refuses undeclared openings and incompatible stitches before subdivision. Each component then finishes its interior geometry against the actual refined rim.

The order is part of the attachment contract:

1. Fit every component against the same original host. Collect exact constraints before adapting any skin.
2. Blend the surrounding skin, remove the declared original triangle ordinals, and attach each component using shared vertex identities.
3. Join the cranium and neck, validate declared openings, and subdivide the complete cage once.
4. Evaluate optional surface layers against the same refined host. Their engine fields use metres; the adapter returns millimetres and fades displacement at open rims.
5. Collect optional final component proposals against one immutable refined surface. Corneal lid contact uses this stage; conflicting requests for the same shared vertex are refused.
6. Recompute common normals, split material regions, and build component interiors against the final refined boundary. Attach ears by sampling that actual head surface. Coarse hair fits the scalp's height/depth and adds lateral clearance for resident ears separately.

The aperture fade supplies both a bounded scalar weight and its spatial gradient to the engine deformation. A faded displacement has a different Jacobian from its unfaded field, so orientation checks run on that complete map. Vertex gradients are area-weighted observations of the distance field on the refined mesh, with the quintic derivative and millimetre/metre conversion explicit in `portraitSurface.ts`. The engine also checks emitted triangle orientation against transported source-face directions. These checks preserve supported large turns; they are not a global self-intersection proof.

The `measuredPortraitAssembly` supplies paired cheek layers plus named nasal, orbital and perioral supports. Each region carries its attachment, offset, XYZ support radii and signed displacement. The nasal layer distinguishes tip domes, alar lobules, their facial boundaries and columellar support; the perioral layer distinguishes philtral columns, their groove and the lip-to-chin transition. These are compact surface envelopes, not reconstructed internal tissues or a muscle simulation. A shallow nasolabial relief follows the current smile; the medial tear-trough depression is disabled. These are authored shape choices, not age measurements. Fine wrinkles remain deferred. Ear roots are embedded separate shells, not welded to the skin.

`portraitNasalLayerFor(detail?)` in `anatomy.ts` is the optional numerical replacement path for the nasal layer. Omission retains those basic supports. A supplied radius and named control array uses `createPortraitControlLayer` to solve the total requested XYZ movement at each control, including stationary anchors. Replace the layer with ID `nasal-subunits` in a chosen assembly before calling `buildReferencePortrait`; the source and lining consume one field. The retained `portraitNasalDetail` preset was rejected after its `0af74958` capture produced a broad flat tip. It is an inspectable experiment, not the active portrait fit or a recommended default.

This prototype currently exposes replaceable procedural eyes, noses and mouths. Ears, cranium and neck remain subject builders. Numerical controls do not establish anatomical correctness.

```ts
import {
  alternatePortraitEye,
  alternatePortraitNose,
  measuredPortraitAssembly,
  portraitComponentsFor,
  portraitEyeShape,
} from "./generated-korean-girl-01/configuration";
import { buildReferencePortrait } from "./generated-korean-girl-01/model";

const model = buildReferencePortrait({
  ...measuredPortraitAssembly,
  components: portraitComponentsFor(
    portraitEyeShape,       // anatomical right eye
    alternatePortraitEye,  // independently replaced left eye
    alternatePortraitNose,
  ),
  subdivisionRounds: 3,
});
```

Eye controls include aperture width/opening, outer-corner lift, orbital depth, lid fold, iris/pupil radius and spherical surface curvature. Nose controls include overall width, tip/alar projection, aperture dimensions, aperture rise/tilt and cavity dimensions. Mouth controls include width, opening, corner elevation, upper/lower lip projection, individual crown dimensions, dental-row placement and tooth spacing. Tessellation is explicit. Factories copy their inputs, so editing one preset does not mutate an existing component. A fourth argument to `portraitComponentsFor` replaces the mouth shape; omission selects this subject's current smile.

The optional mouth `section` profile separates `upperBody`, `upperTubercle`, `lowerBody` and `lowerPads` projections in millimetres. Tubercle/pad widths and pad offset are fractions of the inner mouth's half-width. Coordinates follow the actual curved upper/lower opening and outer vermilion loop; a raised lower lip stays lower even above the overall mouth midpoint. The smooth section is exactly zero at the two band boundaries and corners. It changes existing shared lip vertices, then the ordinary subdivision and common-normal calculation continue into adjacent skin. Zero projections reproduce the existing band; omission disables added section relief. These are anatomy-inspired surface controls, not a muscle or filler simulation. The [histological study of Cupid's bow](https://pubmed.ncbi.nlm.nih.gov/8341737/) describes the cutaneous-vermilion junction as a structural prominence; the model does not substitute a painted white stripe for that form.

Each eye accepts a separate `browProfile` containing fibre radius, radius variation, taper, surface clearance, arch, outward bend and longitudinal sampling. `browFibres` is an integer from zero through 4096; zero disables that brow. The socket's upper/lower brow boundaries supply its planar distribution. Every fibre sample queries the front envelope of the final skin and offsets along its estimated normal, so changing the orbital or forehead surface moves its attachment with that surface. Length controls use millimetres; they are authored values rather than measurements of this person's hair. A path outside the supporting skin refuses. The shared strand sweep also refuses zero, nonfinite or Z-parallel tangents because its cross-section guide is Z.

Nostril width and height act in each opening's fitted plane, about its centroid. Width follows projected head X, with head Y as the guide for a plane exactly normal to X; height is perpendicular within that plane. Sizing retains the rim's normal residual and therefore does not flatten its irregularity. Overall nasal width then scales head X, and `nostrilTilt` rotates the opening and cavity offset around head X. The lining reads the resulting shared rim, so shrinking the aperture also moves its support rings. `rimRoundness: 0` preserves the measured rim before sizing; nonzero values blend towards its fitted ellipse.

The optional `nasalSection.ts` evaluator supplies a clamped cubic depth loft with independent transverse/vertical control stations and a smooth identity transition. Both exterior and rim fitting read that same depth basis. Its control data remains inactive after the first active preset was visually rejected: changing the rim depths also changed its fitted aperture frame, and the final lower-tip/lining relationship worsened. The analytic helper's smoothness does not certify the surface after sparse sampling, fitting and subdivision. The current assembly retains its recovered nasal supports while that relationship is investigated.

Use `portraitCheekLayersFor(rightShape, leftShape)` to replace the paired cheek settings in `assembly.surfaceLayers`. Each cheek region has transverse, vertical and depth support radii plus anterior projection and upward lift, all in millimetres. Its optional `offset: [outward, up, forward]` shifts the support centre relative to the live skin anchor. The outward axis mirrors by anatomical side: `[-7, 6, 0]` moves both medial envelopes 7 mm towards the nose and 6 mm upwards. Omission preserves the bound centre. This keeps envelope placement separate from volume and allows the anchor to follow component replacement. The nasolabial groove has separate width, depth and depth-support controls. Its field spacing follows the support metric and its endpoint fade follows physical path distance. Preserve the rest of `measuredPortraitAssembly` when changing one component so its other anatomical layers remain selected.

See the [inspection record](generated-korean-girl-01/review.md#component-replacement) for the current numerical checks and pending replacement renders.

The optional [nasal lobule sections](generated-korean-girl-01/nasalLobule.ts) prescribe anterior depth through independent transverse, vertical and depth radii on retained skin datums. The nose applies them to exterior and aperture samples together. The active trial replaces the prior nasal inflation layer with three sections; omission or an empty section list preserves the component's basic depth calculation. A complete section/body basis cannot be selected simultaneously. This trial still requires visual acceptance.

## Export a GLTF

Run the tracked exporter from the repository root after installing the workspace dependencies. The exporter uses repository-relative output paths and writes staging artifacts in `.shots/face-experiment/`; export alone does not replace the published `preview/` bundle.

```powershell
./test/node_modules/.bin/tsx.cmd test/scripts/face-review/export.ts
```

The GLB is self-contained. The JSON GLTF uses its sibling `portrait.bin`. `portraitDocument` preserves metallic/roughness colour, emission, alpha mode, sidedness and the supported scalar transmission, IOR, volume and clearcoat extensions. Every GLTF reader or writer must register `portraitGltfExtensions`; an unregistered SDK writer can discard extension data. The converter refuses rigs and texture assets. Positive material thickness requires a closed manifold mesh.

Export checks actual representation precision. Each part's placement is compared with the same engine transform applied to translation-free face coordinates, preventing a large origin from silently erasing a face before Float32 conversion. The converter then checks each nonredundant placed face at Float32 precision and validates every final material group's manifold/winding, with closure additionally required for optical volume. Original pole/seam redundancy uses the engine's existing welded triangle identities. It is not a subject-specific area allowance, and equal before/after degenerate counts cannot excuse a different newly lost face.

## Inspect and revise

For each geometry round, complete numerical checks, format, commit and push the changed source before its visual review. Open the actual current GLTF captures, then write a detailed `.shots/face-experiment/preview/REVIEW.md` naming the source commit and artifact identities, every view's observations, unresolved differences, proven causes versus hypotheses, and the next coherent correction. Post a formal `COMMENT` review on the Draft PR with the remaining failures and next action. A new capture replaces the previous bundle; author its current review again rather than carrying forward an old verdict.

`test/lint.config.ts` connects the model to every H2 view in its inspection record and connects `review.ts` to the complete construction export population. TypeScript evidence uses type-only imports and `{@link ...}` targets. A changed referenced declaration invalidates its `@evidenceReview` fingerprint. New source enters either its declared subject or the shared residual population.

The model review graph reports warnings. Rendering precedes visual review, so missing or expired review evidence must allow the authoring entrypoint to run under `ttsx`. A warning remains an outstanding inspection obligation; it does not accept the model's appearance.

Before changing geometry or an appearance dependency, remove the affected review companions. Build a new GLTF, freeze its bytes and capture profile, and inspect front, both obliques, both profiles, back, reference pose and clay. Compare visible feature boundaries against the original image. Write the observed failures as well as the successes, then write new review companions. A compiler-provided fingerprint is not a visual review, and a green graph is not an acceptance of likeness.

Run `test/scripts/face-review/preview.ps1` from PowerShell to export and publish the latest complete bundle. The script requires the installed workspace, Chromium and Blender 5.1 at its declared local path. It publishes `.shots/face-experiment/preview` only after export, all fourteen Cycles captures and comparison verification finish. The bundle includes `portrait.glb`, JSON GLTF/buffer, the hash-checked `model.json` with named parts, `comparison.png`, `views.png`, `clay-views.png`, camera/light profile and hashes. Previous and incomplete capture directories are recycled instead of accumulating numbered rounds. A failed export or render leaves the previous complete preview available.

```powershell
./test/scripts/face-review/preview.ps1
```

The Blender executable is `C:/Program Files/Blender Foundation/Blender 5.1/blender.exe`. The comparison step uses the Playwright Chromium installation available to `test`; install that browser with `pnpm --filter @automovie/test exec playwright install chromium` if it is absent. Progress and process failures are written to `.shots/face-experiment/preview.log`. The publisher and diagnostic writers share an exclusive-create `preview.lock`; wait for its owner to finish before starting another writer. An interrupted Node diagnostic can leave the file behind. Inspect process ownership before manually removing such a lease; a timestamp alone does not establish that its owner has stopped.

`comparison.png` places the source photograph beside an actual GLTF render. `reference.png` is also a render, in the estimated source-camera pose. `views.png` contains nine views, including steep top/bottom and an opposing rear oblique and `clay-views.png` contains three views without the colour finishes. The receipts inside `preview/` identify the exact model, configuration, profile and frame bytes. Read those files for artifact identity; a source edit may be newer than the last successfully published capture.

`captureProfile.ts` owns Cycles sampling and its explicit denoising switch. Current broad-form inspection uses 64 samples with denoising enabled. Fine hair and brow judgments remain deferred; the filter can change small surface features. Compare the capture profile as well as the GLB digest when assessing an appearance change.

The review points to the fixed preview path and records the exact inspected GLB digest. A new preview does not automatically renew that review or its evidence comments. Renderer differences must not be credited as geometry improvements. Import-only changes, private module state and external renderer-script changes also require a new manual inspection even when a public-declaration fingerprint does not change.

Run `pnpm --filter @automovie/test build` for the source and face-review script graph/type checks and `pnpm --filter @automovie/test start --include test_subject_` for the pure unit scenarios. Those tests check geometry, assembly and export behavior. Likeness is judged from the frames.

## Observe captured feature dimensions

Run `./test/node_modules/.bin/tsx.cmd test/scripts/face-review/measure-preview.ts` after complete publication to compare image-detector estimates with the exact captured scleral boundaries. The optional diagnostic uses the existing `.references/face-measurement` setup (`measure.html`, `vision_bundle.mjs`, `face_landmarker.task`) and records those file hashes and the browser version. Its versioned remote MediaPipe WASM response bytes are not pinned; this is not a complete runtime digest. It writes `preview/landmark-observation.json` and preserves the separate anatomical study's frozen measurements. Synthetic-image detector estimates are not ground truth: inspect them beside the named mesh boundary and actual image before changing shape parameters.

Both that observer and `project-landmarks.ts` hold the shared lease from capture reads through publication. They validate every consumed source, model, GLB, configuration, profile and reference-image byte population and recheck the entire receipt digest before writing, so a different renderer/frame with the same GLB/profile is a different generation. Projection prepares its PNG in memory and writes a receipt containing both PNG and capture SHA-256 after the image. A failed write can leave an incomplete pair; consumers must check those identities. This is not crash-atomic multi-file publication or protection against arbitrary concurrent writers that ignore the lease.
