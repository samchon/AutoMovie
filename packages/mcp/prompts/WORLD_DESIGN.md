# World Design

`setWorldDesign` stores queryable space: landmarks, surfaces, and routes. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters. Surface polygons live in XZ and carry either a constant height or a plane. Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

`effectRecipes` declare bounded deterministic fog, smoke, or dust billboards: fixed seed, emission interval, particle envelope, motion, hard live-particle cap, LOD distance, color, opacity, and alpha blending. `effectZones` place a recipe inside one finite non-empty world-space box with a second seed. The production-wide particle reservation is bounded; arbitrary shaders, fluid solvers, unbounded emitters, and GPU randomness are outside this contract.

`instanceSets` place compact non-formation crowds, vegetation, props, or debris.
Choose a model recipe and one layout: rectangular `grid`, seeded disk
`scatter`, or `along-route` with bounded lateral jitter. Scale, exact
`#RRGGBB` palette choice, and named numeric traits are regenerated from the
set's safe-integer seed; do not expand members into scene nodes. Counts,
derived extents, aggregate matrices/colors/traits, route references, and
world-coordinate bounds are validated before compilation.

The engine world kit constructs constant terrain, ramps, visible wall/building
box blocks, and the three instance layouts. `assertWorldPlacements` rejects
overlapping blocks, a block whose entire footprint lacks one matching support
surface, blocked routes, and unreachable landmarks. It evaluates every
candidate support surface, so an overlapping lower ground plane cannot hide the
platform that actually supports a block.

Validate terrain and choreography with `queryGeometry` instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.
