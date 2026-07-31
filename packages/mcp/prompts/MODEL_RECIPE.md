# Model Recipe

A tracked model recipe record stores one bounded primitive recipe. It does not accept a free-form mesh graph.

Pick a supported archetype and only its documented scalar parameters. The compiler rejects unknown keys and out-of-range values; this prevents the recipe map from becoming an escape hatch back to arbitrary JSON. The foundation compiler accepts exactly one named palette color per recipe and applies it to every primitive part; use separate recipes when silhouettes need distinct colors. Capabilities are bounded semantic declarations visible to source and review, and attachments name sockets on bones that the generated skeleton actually contains.

The current parameter contract is exact:

| archetype        | required parameters                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stickman`       | `height` 0.5–3 m, `headRadius` 0.05–0.5 m, `limbRadius` 0.01–0.25 m                                                                                                  |
| `horse`          | `length` 0.5–4 m, `height` 0.5–3 m, `legLength` 0.2–2 m                                                                                                              |
| `artillery`      | `barrelLength` 0.2–8 m, `wheelRadius` 0.1–3 m, `gauge` 0.2–5 m                                                                                                       |
| `flag`           | `width` 0.1–10 m, `height` 0.1–10 m, `poleHeight` 0.2–20 m                                                                                                           |
| `weapon`         | `length` 0.05–8 m, `thickness` 0.001–1 m                                                                                                                             |
| `primitive-prop` | `shape` plus dimensions: `box` width/height/depth, `sphere` radius, `capsule` radius/height, `cylinder` radius/height, `cone` radius/height, or `plane` width/depth. |

Primitive-prop width, height, and depth are 0.001–100 m; radius is 0.001–50 m. Do not include dimensions unused by the selected shape. Material colors are six-digit `#RRGGBB`. LOD tiers are unique and ordered `hero`, `near`, `far`; finite maximum distances are positive and strictly increasing, and only the final tier may use `null`.

Capability declarations are narrower than the string-shaped field suggests. Today only `stickman` accepts `signal`; the coding-agent source still authors and validates the actual signaling motion, while every other archetype uses an empty capability list. Bone attachment names are currently accepted only when that bone is present on the compiler-owned stickman skeleton, and the foundation materializer does not create attached scene nodes for them. The server refuses an unknown declaration rather than pretending it was implemented.

Typed engine capabilities live in `profiles`, separately from the legacy
recipe-level string labels. `profile.gaits` proves locomotion. A `shooter` trait
owns a non-empty unique inventory of firearm, cannon, or melee data;
`mountable` owns seats and payload mass; `destructible` owns durability and an
impact body. Firearm accuracy distances are strictly increasing, cannon
ammunition kinds are unique, and every physical scalar is bounded by design
lint and the same public engine validator. A name such as `musket` or
`artillery` never grants a verb by convention.

Primitive props are static and always materialize without a skeleton. Do not send `rigged`; the validator refuses it until a deterministic prop-rig schema, compiler binding, and viewer path exist.

LOD is a reference graph emitted in the generated contract. `hero`, `near`, and `far` entries name recipes, with increasing distance limits and one final unbounded tier where appropriate. The scaffold viewer automatically selects anonymous formation `near` and `far` tiers from camera distance, representative projected contribution, and hysteresis. Named heroes remain explicit objects, and ordinary non-formation nodes keep their source-selected runtime model. Do not expand a formation into one model recipe per soldier. Ordinary members share a recipe; only intentional hero slots become named actors.

The production compiler materializes every supported recipe as an immutable runtime model before it executes a shot builder. Use `context.runtimeModels[recipeId]` and its exact generated model id; do not duplicate the primitive model in source. Formation models are inserted automatically from their recipes.

An unsupported archetype, parameter, attachment, or capability must remain a diagnostic, never a silent placeholder claimed as complete. The canonical production surface does not yet bind arbitrary custom mesh models: declared source/content roots affect identity but are not a model loader. Keep custom geometry outside this foundation contract until an explicit asset-registration and compiler-binding path exists; do not smuggle it through `parameters` or cite a fingerprint-only content file as a bound model.
