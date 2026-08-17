# Model Recipe

A tracked model recipe record stores one bounded primitive recipe. It does not accept a free-form mesh graph.

## The archetype owns every other field

`archetype` names a registered builder, not a member of a fixed list. The compiler resolves it against the archetype catalogue the production registers, and a recipe naming nothing registered is refused with `model-archetype-unregistered` rather than built as a placeholder. The catalogue is the authority on every other field of the recipe: which parameter keys are required, which are accepted at all, the bounds of each, which capabilities the archetype implements, and which bones it can carry an attachment on. Ask it, do not guess.

The registered catalogue for a scaffolded production is composed in `scripts/compile.ts` from `AUTOMOVIE_PRIMITIVE_ARCHETYPES` in `@automovie/archetypes`. Read the definition you intend to use: `parameters` gives every accepted key with its value kind and inclusive bounds, `plan(parameters)` gives the required and accepted keys for a specific map, `capabilities` gives the exact semantic labels the recipe may declare, and `bones` gives the skeleton the builder materializes. An empty list means the archetype has no skeleton, so it accepts no attachments and binds only static ingest profiles. A production that needs geometry no registered archetype builds registers another definition; it does not smuggle the shape through `parameters`.

Send only the parameters the selected archetype's plan calls for. The compiler rejects unknown keys and out-of-range values; this prevents the recipe map from becoming an escape hatch back to arbitrary JSON. A parameter the archetype accepts in general but the selected map does not use, a dimension belonging to a different shape for instance, is refused rather than stored. The foundation compiler accepts exactly one named palette color per recipe and applies it to every primitive part; use separate recipes when silhouettes need distinct colors. Material colors are six-digit `#RRGGBB`. LOD tiers are unique and ordered `hero`, `near`, `far`; finite maximum distances are positive and strictly increasing, and only the final tier may use `null`.

Capability and attachment declarations are narrower than their string-shaped fields suggest. A capability outside the archetype's own list is refused, and declaring one the archetype does implement still leaves the coding-agent source to author and validate the actual motion. A bone attachment is accepted only when that bone is on the skeleton the archetype's builder materializes, and the foundation materializer does not create attached scene nodes for it. The server refuses an unknown declaration rather than pretending it was implemented.

Typed engine capabilities live in `profiles`, separately from recipe-level string labels. `profile.gaits` proves locomotion. A `mountable` trait owns seats and payload mass; `destructible` owns durability and an impact body. Trait kinds are unique within a profile, and every physical scalar is bounded by design lint and the same public engine validator. A descriptive name never grants a verb by convention.

An archetype whose `bones` list is empty materializes without a skeleton. Do not try to rig one through a parameter such as `rigged`; the validator refuses any key outside the archetype's schema, and an articulated runtime comes from registering an archetype whose builder owns a skeleton.

## LOD and runtime models

LOD is a reference graph emitted in the generated contract. `hero`, `near`, and `far` entries name recipes, with increasing distance limits and one final unbounded tier where appropriate. The scaffold viewer automatically selects anonymous formation `near` and `far` tiers from camera distance, representative projected contribution, and hysteresis. Named heroes remain explicit objects, and ordinary non-formation nodes keep their source-selected runtime model. Do not expand a formation into one model recipe per member. Ordinary members share a recipe; only intentional hero slots become named actors.

The production compiler materializes every registered recipe as an immutable runtime model before it executes a shot builder. Use `context.runtimeModels[recipeId]` and its exact generated model id; do not duplicate the model or its proxy in source. Formation models are inserted automatically from their recipes.

## Binding an external appearance

To bind an external appearance, set `asset` to one exact glTF, GLB, or VRM path registered in `.automovie/assets.json`. Its typed `model` record must use one supported ingest profile (`gltf-static-v1`, `gltf-humanoid-v1`, or `vrm-humanoid-v1`), bind its own bytes as the first `hero` LOD, register every external buffer/image sidecar, and declare both deterministic proxies. The compiler reads every declared payload range and rejects short, missing, or stale bytes. Sidecars and non-hero LODs need a `model-resource` use whose id is the hero model path; byte-authored proxies need the corresponding `model-proxy` use. Collision accepts `capsule-v1 { radius, height }` or `box-v1 { width, height, depth }`; measurement accepts `box-v1` or `humanoid-landmarks-v1 { height, shoulderWidth, hipWidth }`. Every value is finite and strictly positive. A proxy may instead cite a registered version-1 JSON proxy asset carrying the matching closed shape.

The compiler ingests and fingerprints the fixed model bytes, exposes the registered asset as the runtime model's final imported appearance, and keeps the proxy geometry for engine validation, collision, mass, distance, and projection semantics. Static profiles bind only to skeleton-free recipes. Humanoid profiles bind only to articulated recipes and must prove every runtime bone; VRM playback uses authoritative VRM humanoid nodes and normalization. Every LOD uses the same profile. The scaffold viewer loads only the compiled digest closure through the imported-model adapter for shots, films, turntables, and ROM-extremes review. A malformed model, unregistered sidecar, unsupported profile, missing rig mapping, or absent/invalid proxy is a compile error; there is no inferred mesh fallback.

Instancing takes an imported prototype only where it is rigid. An instance set may select a registered external model on the `gltf-static-v1` profile, as its default `modelRecipe`, as any weighted prototype, or as any LOD recipe either of them names; a skinned, morphed, or animated profile is refused there with `asset-model-instancing-unsupported`, and those belong on named nodes. Anonymous formation members refuse every registered external model under that same diagnostic whatever its profile, because an anonymous tier has no imported-mesh path at all: use a generated anonymous tier, or promote the slot to a named hero.

## Materials, color spaces, and textures

What follows is about a model's materials, which a recipe does not author. A recipe's whole appearance surface is its single `palette` entry: the compiler decodes that one swatch into one flat material carrying no texture and offering no field to bind one through. The archetypes `@automovie/archetypes` registers build primitive parts besides, and a primitive carries no texture coordinates and none are generated for it downstream, so an image bound to one would have nothing to sample even if a recipe could name it. The physically based surface below is reached through the `models` a shot program returns, whose parts carry meshes your own source built, and through an imported asset's own appearance. Which path a subject takes therefore decides whether it can carry a finish at all, and that is settled before the recipe is written rather than after the surface reads flat.

A model's materials are physically based, and a flat base color is the floor of that contract rather than its ceiling. Beside `baseColor` and `baseColorTexture`, a material may bind a combined metallic-roughness map, a tangent-space normal map with a signed `normalScale`, an occlusion map with a strength, and an emissive map multiplied by the emissive color. `alphaMode` states `opaque`, `mask` with an `alphaCutoff`, or `blend` explicitly, instead of leaving a renderer to infer blending from an opacity number. `doubleSided` says whether the back of a surface exists. `transmission`, `ior`, `thickness`, and `clearcoat` describe glass, water, and lacquer as dielectrics rather than as a low opacity that fakes them.

Colors live in two spaces and the product does the conversion, so author each one in the space its field is typed in.

A `#RRGGBB` string is an sRGB swatch, the thing a paint chip or a reference photo hands you, and the compiler decodes a recipe `palette` into the material's linear `baseColor` while the viewer decodes an instance palette the same way. `IAutoMovieColor`, which is what `baseColor`, `emissive`, light color, and fog color actually are, holds linear numbers instead, and its `hex` is a label derived from them rather than a second source of truth.

Pasting swatch digits into that triple is the one mistake worth naming. `#808080` becomes `0.502` where the swatch means `0.216`, so the surface renders about 2.3x too bright, and a surface half covered by instanced units and half by a recipe material drawn that way reads as two colors with a bright seam between them.

The engine owns both directions as `srgbHexToLinearColor` and `linearColorToSrgbHex`. A project script under `scripts/` may reach for them when it needs to carry a swatch into a triple by hand.

A texture binding is either a bare asset id or a full reference, and the full form is what a real material needs: `texCoord` selects the UV set, `coordinateSource` says what one unit of that set means, `colorSpace` declares whether the stored texels are `srgb` color or `linear` measurement, an optional `transform` offsets, scales, and rotates the UVs around the origin, and an optional `sampler` fixes wrap and filter policy. Get `colorSpace` right at the binding: base color and emissive are colors, while metallic-roughness, normal, and occlusion are measurements, and one image bound under both intents is refused rather than decoded two ways. Read `ASSET_SOURCING` before registering the image itself; the material declares how it is sampled, the manifest declares what it is and who may use it.

Get `coordinateSource` right too, because it decides the arithmetic in `transform.scale`.

| Source | What one unit means | The repeat you want |
| --- | --- | --- |
| `"surface-metres"` | metres of surface distance on a generated automovie surface | `1 / tile`, where `tile` is the metres one turn of the image covers; the surface's own size is not part of the answer |
| `"normalized"` | the `[0, 1]` span of a lattice surface or a pattern module prototype | `extent / tile`, where the size is the whole answer |
| `"source-uv"` | arbitrary authored coordinates kept by an imported mesh | whatever its source layout or adoption receipt states, because no general physical-scale formula exists |

Omission preserves legacy raw UV sampling and makes no claim about physical or normalized units.

A binding written for one source and applied to another reads as flat paint or as one tile smeared across a floor, and nothing downstream can recover the intended scale.

Reuse is what the difference decides. Under `"surface-metres"` one binding serves a 9 m floor and a 0.1 m post at once, because `1 / tile` is a property of the image and not of either surface. Under `"normalized"` the same two want repeats ninety times apart, and one binding cannot be right on both.

Read `GEOMETRY` for which constructor emits coordinates and in which frame.

`texCoord` is zero, and `validateModel` refuses every other value on an imported model record as much as on a generated one. That is not a default among several sets: there is no second set to select, because generated geometry emits set zero alone and no packed atlas exists to author against.

Declaring a source also makes the pairing checkable. `validateTextureScale` reads a model's parts beside its materials, refuses a `"normalized"` binding on a set measuring more than one, and warns when a `"surface-metres"` binding implies a tile larger than the surface it is bound to and the axis does not clamp.

Compilation does not run it and shot source cannot import it, so a project script under `scripts/` is what measures the models a build produced. `npm run texture:scale` reports how many models, parts, coordinate-bearing parts, and structured bindings it examined, so a run that found nothing because nothing declared a coordinate source cannot be read as a run that found nothing wrong.

## Look at the model you built

A recipe that compiles is not a recipe that is right. A box where an oriel window belonged, a shaft with no head, a rack holding nothing: each compiled, passed lint, and shipped, because a model nobody opened alone is a model nobody checked.

1. `captureTurntable({ asset })` commits the whole set an asset review is judged from in one call.
2. `captureFrame` with a `part` on the asset target narrows the camera onto one compiled part when a whole-model view cannot resolve it.
3. `prepareReview` and `submitReview` under `REVIEW_ASSET` record the verdict, and the worksheet names the required views still missing.

Read `CAPTURE_FRAME` before the first of those calls and `REVIEW_ASSET` before the last.

## Refusals

An unregistered archetype, or an unsupported parameter, attachment, ingest profile, or capability, must remain a diagnostic, never a silent placeholder claimed as complete. Do not smuggle custom geometry through `parameters` or cite fingerprint-only content as a bound model.
