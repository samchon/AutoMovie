# Model Recipe

A tracked model recipe record stores one bounded primitive recipe. It does not accept a free-form mesh graph.

Pick a supported archetype and only its documented scalar parameters. The compiler rejects unknown keys and out-of-range values; this prevents the recipe map from becoming an escape hatch back to arbitrary JSON. The foundation compiler accepts exactly one named palette color per recipe and applies it to every primitive part; use separate recipes when silhouettes need distinct colors. Capabilities are bounded semantic declarations visible to source and review, and attachments name sockets on bones that the generated skeleton actually contains.

The current parameter contract is exact:

| archetype        | required parameters                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stickman`       | `height` 0.5–3 m, `headRadius` 0.05–0.5 m, `limbRadius` 0.01–0.25 m                                                                                                  |
| `primitive-prop` | `shape` plus dimensions: `box` width/height/depth, `sphere` radius, `capsule` radius/height, `cylinder` radius/height, `cone` radius/height, or `plane` width/depth. |

Primitive-prop width, height, and depth are 0.001–100 m; radius is 0.001–50 m. Do not include dimensions unused by the selected shape. Material colors are six-digit `#RRGGBB`. LOD tiers are unique and ordered `hero`, `near`, `far`; finite maximum distances are positive and strictly increasing, and only the final tier may use `null`.

Capability declarations are narrower than the string-shaped field suggests. Today only `stickman` accepts `signal`; the coding-agent source still authors and validates the actual signaling motion, while every other archetype uses an empty capability list. Bone attachment names are currently accepted only when that bone is present on the compiler-owned stickman skeleton, and the foundation materializer does not create attached scene nodes for them. The server refuses an unknown declaration rather than pretending it was implemented.

Typed engine capabilities live in `profiles`, separately from recipe-level
string labels. `profile.gaits` proves locomotion. A `shooter` trait
owns a non-empty unique inventory of firearm, cannon, or melee data;
`mountable` owns seats and payload mass; `destructible` owns durability and an
impact body. Firearm accuracy distances are strictly increasing, cannon
ammunition kinds are unique, and every physical scalar is bounded by design
lint and the same public engine validator. A descriptive name never grants a
verb by convention.

Primitive props are static and always materialize without a skeleton. Do not send `rigged`; the validator refuses it until a deterministic prop-rig schema, compiler binding, and viewer path exist.

LOD is a reference graph emitted in the generated contract. `hero`, `near`, and `far` entries name recipes, with increasing distance limits and one final unbounded tier where appropriate. The scaffold viewer automatically selects anonymous formation `near` and `far` tiers from camera distance, representative projected contribution, and hysteresis. Named heroes remain explicit objects, and ordinary non-formation nodes keep their source-selected runtime model. Do not expand a formation into one model recipe per soldier. Ordinary members share a recipe; only intentional hero slots become named actors.

The production compiler materializes every supported recipe as an immutable runtime model before it executes a shot builder. Use `context.runtimeModels[recipeId]` and its exact generated model id; do not duplicate the model or its proxy in source. Formation models are inserted automatically from their recipes.

To bind an external appearance, set `asset` to one exact glTF, GLB, or VRM path registered in `.automovie/assets.json`. Its typed `model` record must use one supported ingest profile (`gltf-static-v1`, `gltf-humanoid-v1`, or `vrm-humanoid-v1`), bind its own bytes as the first `hero` LOD, register every external buffer/image sidecar, and declare both deterministic proxies. The compiler reads every declared payload range and rejects short, missing, or stale bytes. Sidecars and non-hero LODs need a `model-resource` use whose id is the hero model path; byte-authored proxies need the corresponding `model-proxy` use. Collision accepts `capsule-v1 { radius, height }` or `box-v1 { width, height, depth }`; measurement accepts `box-v1` or `humanoid-landmarks-v1 { height, shoulderWidth, hipWidth }`. Every value is finite and strictly positive. A proxy may instead cite a registered version-1 JSON proxy asset carrying the matching closed shape.

The compiler ingests and fingerprints the fixed model bytes, exposes the registered asset as the runtime model's final imported appearance, and keeps the proxy geometry for engine validation, collision, mass, distance, and projection semantics. Static profiles bind only to skeleton-free recipes. Humanoid profiles bind only to articulated recipes and must prove every runtime bone; VRM playback uses authoritative VRM humanoid nodes and normalization. Every LOD uses the same profile. The scaffold viewer loads only the compiled digest closure through the imported-model adapter for shots, films, turntables, and ROM-extremes review. Registered external models are currently refused for anonymous formation or instance-set members until imported-mesh instancing exists. A malformed model, unregistered sidecar, unsupported profile, missing rig mapping, or absent/invalid proxy is a compile error; there is no inferred mesh fallback.

An unsupported archetype, parameter, attachment, ingest profile, or capability must remain a diagnostic, never a silent placeholder claimed as complete. Do not smuggle custom geometry through `parameters` or cite fingerprint-only content as a bound model.
