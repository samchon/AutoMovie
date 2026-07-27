# Formation Design

`setFormationDesign` represents a unit, not thousands of actor nodes.

The identity of an ordinary member is `formation id + deterministic slot index`. Count, compact layout, spacing, anchor, facing, and seed derive every slot. `line` and `column` capacity must cover count; wedge depth and arc/scatter radius must be positive. Capabilities are the only formation actions source may assume.

Use `heroOverrides` sparingly when a slot needs a persistent named actor, close camera, unique prop, or individual performance. Do not promote every soldier.

Before writing choreography, use `queryGeometry({request:{query:"formation",...}})` and world route width. Source code may then loop over derived slots and compute movement normally. The design stays small while rendering can later choose instances, LOD, or impostors without changing narrative identity.
