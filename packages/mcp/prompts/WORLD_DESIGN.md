# World Design

The tracked world design record stores queryable space: landmarks, surfaces, and routes. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters. Surface polygons live in XZ and carry a height rule: a `constant` level, a `plane` slope, or a `heightfield` lattice of row-major samples the surface interpolates bilinearly, which is how a rise, a terrace, or a bank is stated. Formation members stand on the terrain under each of them, so relief moves a crowd rather than only the ground it stands on. Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

`effectRecipes` declare bounded deterministic fog, smoke, or dust billboards: fixed seed, emission interval, particle envelope, motion, hard live-particle cap, LOD distance, color, opacity, and alpha blending. `effectZones` place a recipe inside one finite non-empty world-space box with a second seed. One recipe may hold at most 4,096 live particles, a world declares at most 256 recipes and 256 zones, and the placed zones together reserve at most 16,384 live particles for the production. Arbitrary shaders, fluid solvers, unbounded emitters, and GPU randomness are outside this contract.

`instanceSets` place compact non-formation crowds, vegetation, props, or debris. Choose a model recipe and one layout: rectangular `grid`, seeded disk `scatter`, or `along-route` with bounded lateral jitter. Scale, exact `#RRGGBB` palette choice, and named numeric traits are regenerated from the set's safe-integer seed; do not expand members into scene nodes. Counts, derived extents, aggregate matrices/colors/traits, route references, and world-coordinate bounds are validated before compilation. One world holds at most 250,000 general instances across every set, and their matrices, colors, scales, and declared traits must fit a 32 MiB viewer budget; a world asking for more is refused rather than degraded.

The engine world kit constructs constant terrain, ramps, sampled heightfields,
visible wall/building box blocks, and the three instance layouts. `assertWorldPlacements` rejects
overlapping blocks, a block whose entire footprint lacks one matching support
surface, blocked routes, and unreachable landmarks. It evaluates every
candidate support surface, so an overlapping lower ground plane cannot hide the
platform that actually supports a block.

Validate terrain and choreography with the programmatic engine geometry API instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.
