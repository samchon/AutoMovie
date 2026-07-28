# Model Recipe

`setModelRecipe` stores a bounded primitive recipe. It does not accept a free-form mesh graph.

Pick a supported archetype and only its documented scalar parameters. The compiler rejects unknown keys and out-of-range values; this prevents the recipe map from becoming an escape hatch back to arbitrary JSON. Palette keys are material roles, capabilities are runtime promises, and attachments name bone sockets.

The current parameter contract is exact:

| archetype | required parameters |
| --- | --- |
| `stickman` | `height` 0.5–3 m, `headRadius` 0.05–0.5 m, `limbRadius` 0.01–0.25 m |
| `horse` | `length` 0.5–4 m, `height` 0.5–3 m, `legLength` 0.2–2 m |
| `artillery` | `barrelLength` 0.2–8 m, `wheelRadius` 0.1–3 m, `gauge` 0.2–5 m |
| `flag` | `width` 0.1–10 m, `height` 0.1–10 m, `poleHeight` 0.2–20 m |
| `weapon` | `length` 0.05–8 m, `thickness` 0.001–1 m |
| `primitive-prop` | `shape` plus dimensions: `box` width/height/depth, `sphere` radius, `capsule` radius/height, `cylinder` radius/height, `cone` radius/height, or `plane` width/depth. Optional `rigged` is boolean. |

Primitive-prop width, height, and depth are 0.001–100 m; radius is 0.001–50 m. Do not include dimensions unused by the selected shape. Material colors are six-digit `#RRGGBB`. LOD tiers are unique and ordered `hero`, `near`, `far`; finite maximum distances are positive and strictly increasing, and only the final tier may use `null`.

Runtime promises are narrower than the string-shaped field suggests. Today only `stickman` implements capability `signal`; every other archetype uses an empty capability list. Bone attachments are currently supported only by the compiler-owned stickman skeleton. The server refuses an aspirational capability or attachment rather than treating it as documentation.

LOD is a reference graph. `hero`, `near`, and `far` entries name recipes, with increasing distance limits and one final unbounded tier where appropriate. Do not expand a formation into one model recipe per soldier. Ordinary members share a recipe; only intentional hero slots become named actors.

The production compiler materializes every supported recipe as an immutable runtime model before it executes a shot builder. Use `context.runtimeModels[recipeId]` and its exact generated model id; do not duplicate the primitive model in source. Formation models are inserted automatically from their recipes.

An unsupported archetype, parameter, attachment, or capability must remain a diagnostic, never a silent placeholder claimed as complete. Put custom high-detail geometry in coding-agent-owned source or declared assets and bind it explicitly; do not smuggle it through `parameters`.
