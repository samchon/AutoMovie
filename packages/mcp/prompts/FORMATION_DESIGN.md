# Formation Design

`setFormationDesign` represents a unit, not thousands of caller-authored actor nodes. The current foundation compiler expands at most 10,000 total formation members in one production into explicit nodes; a larger bound would be dishonest until compiler and viewer instancing replace that representation.

The identity of an ordinary member is `formation id + deterministic slot index`. Count, compact layout, anchor, facing, and seed derive every slot. `line`, `column`, and `wedge` put positive lateral/depth `spacing` inside the layout because their algorithms consume it. `arc` separation is determined only by radius, covered angle, and count; `scatter` density is determined only by radius, seed, and count. Do not send a common spacing field that those layouts would silently ignore. Line and column capacity must cover count; wedge depth squared must cover count; arc/scatter radius must be positive.

`capabilities` is a small review-facing vocabulary for intended unit behavior. It is not a compiler permission system: the foundation compiler neither infers an action from a label nor proves that source avoided an undeclared action. Source authors choreography in code; typed shot predicates, compiled event realization, and frame review establish what actually happened.

Use `heroOverrides` sparingly when a slot needs a persistent named actor, close camera, unique prop, or individual performance. A hero changes only the node identity: the compiler still enforces the formation's model recipe and base transform before source choreography runs. Do not promote every soldier.

Before writing choreography, use `queryGeometry({request:{query:"formation",...}})` and world route width. At compile time, read the exact immutable slots from `context.formationSlots[formationId]`; do not recreate layout arithmetic or emit formation scene nodes yourself. AutoMovie inserts the designed model, transform, slot id, and hero identity into the compiled scene and rejects node collisions or incomplete materialization.

Source code may loop over those slots to compute movement normally. The design stays small while rendering can later choose instances, LOD, or impostors without changing narrative identity.
