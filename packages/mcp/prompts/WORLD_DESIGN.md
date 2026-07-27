# World Design

`setWorldDesign` stores queryable space: landmarks, surfaces, routes, and deterministic effect zones. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters. Surface polygons live in XZ and carry either a constant height or a plane. Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

Fog, smoke, and dust zones carry bounds and a seed. The zone is temporal-effect input, not proof that a renderer already implements the effect. Until the relevant compiler capability exists, expect an explicit planned/unsupported diagnostic.

Validate terrain and choreography with `queryGeometry` instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.
