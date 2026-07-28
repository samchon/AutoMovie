# World Design

`setWorldDesign` stores queryable space: landmarks, surfaces, and routes. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters. Surface polygons live in XZ and carry either a constant height or a plane. Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

`effectZones` is a reserved forward-compatible field. Keep it empty today. Fog, smoke, and dust have no deterministic compiler and renderer binding yet, so `setWorldDesign` refuses a non-empty zone list instead of storing an unrenderable promise. Put an experimental effect in coding-agent-owned source only when its renderer path and evidence are implemented, and do not claim the world complete from the reserved schema alone.

Validate terrain and choreography with `queryGeometry` instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.
