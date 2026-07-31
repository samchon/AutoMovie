# Geometry Oracle

The non-MCP engine geometry API measures the current compiled production. It does not accept a caller-supplied film graph.

Use `distance` for point, actor, and landmark separation; `reach` for a compact current actor-to-target measurement; `pose` for a sampled actor root and joint inventory; `ground` for named world surface height and walkability; `formation` for derived count, bounds, motion, culling, and LOD; `effect` for fixed-step activity, live-particle cap, density, camera-ray intersection, contained subjects, and visibility risk; and `camera` to project animated subject roots through the current camera, FOV, clip planes, and production aspect ratio.

The camera query reports the shot contract's `maxAllowedOcclusionRatio` beside `occlusionMeasured: false`; it does not pretend that root-point projection measures pixel occlusion or full-body framing. Judge those from current beauty, mask, depth, outline, or pose PNG evidence through the review tools.

Compile source before querying. Load and narrow current state with `loadAutoMovieProjectState` and `requireCurrentAutoMovieProjectState` from `@automovie/cli`, then select ids from its authenticated registry; do not guess. Treat a diagnostic as a failed measurement, not a numeric zero. The reader performs Node I/O and must stay outside shot and film build functions.

The geometry oracle is intentionally compact. Source code remains the right place for loops, trajectory construction, choreography, and tests. Call the package API for facts the deterministic engine or current project knows better than prose.
