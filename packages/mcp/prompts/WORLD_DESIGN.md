# World Design

`setWorldDesign` stores queryable space: landmarks, surfaces, and routes. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters. Surface polygons live in XZ and carry either a constant height or a plane. Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

`effectRecipes` declare bounded deterministic fog, smoke, or dust billboards: fixed seed, emission interval, particle envelope, motion, hard live-particle cap, LOD distance, color, opacity, and alpha blending. `effectZones` place a recipe inside one finite non-empty world-space box with a second seed. The production-wide particle reservation is bounded; arbitrary shaders, fluid solvers, unbounded emitters, and GPU randomness are outside this contract.

Validate terrain and choreography with `queryGeometry` instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.
