# World Design

The tracked world design record stores queryable space: landmarks, surfaces, and routes. Visible set meshes remain source or assets.

Coordinates are right-handed, Y-up, in meters.

Surface polygons live in XZ and carry a height rule: a `constant` level, a `plane` slope, or a `heightfield` lattice of row-major samples the surface interpolates bilinearly, which is how a rise, a terrace, or a bank is stated.

A footprint is one simple ring and may be concave, and `holes` cuts voids in it, so an L-shaped plate keeps its notch and a slab with an atrium void is one patch whose void a foot falls through rather than a ring of patches meeting at seams. A ring that crosses itself, and a hole reaching outside its plate or touching another, are refused.

Ground over a footprint is single-valued. An overhang, a vertical face, and a ramp spiralling over its own lower flight cannot be one patch, and the query answers the topmost patch rather than flattening them. Formation members stand on the terrain under each of them, so relief moves a crowd rather than only the ground it stands on.

Mark walkability honestly. Routes are named centerlines with a formation-width limit; they are not pre-baked motion. Landmarks give tactics and camera queries stable names.

A shot's staged `space` states its standable patches with that same height rule, and one engine function answers both records, so a named performer and the crowd behind it stand and plant feet on one ground. A patch states its height exactly once: give it a `height` rule, or the two-anchor `anchor`/`rampTo` spelling that says the level and single-plane cases; carrying both, or neither, is refused. Terrain that rises has no anchors to be written with, so a shot staged on relief carries the rule.

`effectRecipes` declare bounded deterministic fog, smoke, or dust billboards: fixed seed, emission interval, particle envelope, motion, hard live-particle cap, LOD distance, color, opacity, and alpha blending. `effectZones` place a recipe inside one finite non-empty world-space box with a second seed. One recipe may hold at most 4,096 live particles, a world declares at most 256 recipes and 256 zones, and the placed zones together reserve at most 16,384 live particles for the production. Arbitrary shaders, fluid solvers, unbounded emitters, and GPU randomness are outside this contract.

`instanceSets` place compact non-formation crowds, vegetation, props, debris, and repeated building parts.

Choose a model recipe and one layout: rectangular `grid`, seeded disk `scatter`, `along-route` with bounded lateral jitter, three-dimensional `lattice` with per-axis spacing over rows, columns, and layers, or `explicit`, which carries one exact entry per declared slot.

Scale, exact `#RRGGBB` palette choice, and named numeric traits are regenerated from the set's safe-integer seed. Do not expand members into scene nodes.

A palette entry is an sRGB swatch and is decoded into the renderer's linear space, exactly as a model recipe's own palette is, so the same string in both places renders one color. `MODEL_RECIPE` says what that costs when a swatch is instead typed straight into a linear `IAutoMovieColor`.

Counts, derived extents, aggregate matrices, colors, traits, route references, and world-coordinate bounds are validated before compilation. One world holds at most 250,000 general instances across every set, and their matrices, colors, scales, and declared traits must fit a 32 MiB viewer budget. A world asking for more is refused rather than degraded.

Reach for `lattice` when the repetition is volumetric: a curtain-wall grid over storeys, a rack, a colonnade in two directions, a stack of identical balconies. Reach for `explicit` when a program computed the placements and no seed can reproduce them: the output of a surface-pattern run, a scatter you rejected and hand-corrected, a set imported from a measured survey. An explicit entry carries a stable id, a translation, an exact unit quaternion, a per-axis scale, and optional per-slot `prototype`, `visible`, `palette`, and `traits` overrides, so the block stays one compact buffer instead of becoming individual nodes. Explicit is the escape hatch from a placement law, not from instancing; if you find yourself typing transforms one at a time, the law is missing, not the feature.

A set may declare a weighted `prototypes` table beside its `modelRecipe`, which stays the default. Each prototype names its own recipe and a positive selection weight, and the choice is deterministic from seed and slot, so a hedgerow of three shrub recipes or a facade of four panel types is one set rather than three sets that have to be kept in step. Variation widens the same way: `scale3` gives independent per-axis ranges, `rotationDeg` gives seeded XYZ Euler offsets applied after facing, and `visibleProbability` thins a procedural set without changing its declared count. All of it regenerates from the seed; none of it is stored per member.

A set that repeats a building's own parts belongs to that building rather than to the world. Declare it in the built environment's `populations`, pairing the logical space it stands in with this same set record, and the lowering hands the set to the world for you. The set the world stages and the set a room measures are then one record, so asking a room what stands in it names the field instead of missing it. `BUILT_ENVIRONMENT` owns that pairing and the model-local `prototypeBounds` a compact population declares beside it.

`builtInstanceSetPlacementBounds(` answers where a set actually stands: give it the set and one model-local prototype box and it folds the declared law, taking a grid's or a lattice's occupied hull corners, a scatter's declared disk, and explicit transforms exactly, so a set of thousands costs what a set of four costs. Seeded rotation ranges answer conservatively rather than pretending to know which slot sampled which angle, and `visibleProbability` never shrinks the result, because this is the declared placement envelope and not the members visible in one render sample. `along-route` is refused: its slots follow a world route the fold is not handed.

The engine world kit constructs constant terrain, ramps, sampled heightfields, visible wall/building box blocks, and the seeded instance layouts `grid`, `scatter` and `along-route`; `lattice` and `explicit` are compiler-materialized and have no world-kit builder. `assertWorldPlacements` rejects overlapping blocks, a block whose entire footprint lacks one matching support surface, blocked routes, and unreachable landmarks. It evaluates every candidate support surface, so an overlapping lower ground plane cannot hide the platform that actually supports a block.

Validate terrain and choreography with the programmatic engine geometry API instead of estimating from prose. A shot source should use the injected ground oracle rather than duplicating its own unrelated height formula.

A world is a system of meaningful places, routes, constraints, and environmental cues. Decorative density is not world design. Begin with the actions and spatial decisions the screenplay requires, then build enough terrain and landmarks to make those decisions readable.

## Semantic layout

List stable anchors before generating detail:

- entrances, exits, objectives, threats, refuges, observation points, and horizon features;
- routes with width, slope, surface, direction, and traversal class;
- regions with narrative function, material, vegetation, occupancy, and visibility;
- ground contacts and height references for every staged subject;
- light, weather, atmosphere, and effect bounds.

Give each anchor a stable id. Shot contracts and acceptance scenarios refer to meaning, not guessed coordinates. Coordinates remain deterministic engine facts derived from the authored world record.

## Scale and traversal

Choose world units from the production contract and verify human, vehicle, building, terrain, and formation scale together. A road wide enough in a map may fail when a formation, turning radius, camera, and occlusion are considered. Test travel distance, slope, clearance, reach, line of sight, and camera distance with engine queries rather than by eye. The building queries and `worldSurfaceHeight(` are on the sandbox surface, so a shot module checks its own staging as it builds it; only a study that writes a document has to run from a project script.

Preserve walkable or traversable continuity. Place barriers where they communicate or constrain action, not where procedural noise happens to put them. Mark dangerous or forbidden regions explicitly. Do not rely on render detail to enforce a physical rule the engine does not know.

## Procedural generation

Use deterministic seeds and bounded algorithms. Generate from semantic anchors outward:

1. lock story-critical anchors and routes;
2. derive large terrain forms and visibility corridors;
3. allocate secondary regions;
4. scatter repeated detail with exclusion zones and density limits;
5. add authored hero exceptions;
6. verify bounds, contacts, overlaps, and required sightlines.

OpenUSD composition is a useful mental model for complex external worlds: references and payloads let assets compose without destructive copying, while variant sets preserve explicit alternatives. Regardless of format, register exact source, license, digest, conversion, and chosen variant in AutoMovie ownership.

## Environmental storytelling

Let the world show prior action, use, culture, logistics, weather, and conflict through wear, orientation, debris, routes, defenses, vegetation, sound, and light. Repetition establishes a system; one deliberate exception directs attention. Keep hero landmarks distinct in silhouette and value so they remain useful to both characters and camera.

## Atmosphere and effects

Fog, smoke, dust, rain, fire, and crowds need spatial and temporal bounds. They may reveal scale, hide transitions, carry wind, or change visibility, but they must not erase required subjects or acceptance evidence. Treat effects as authored systems with source, lifetime, region, density, and delivery cost.

## Look at the world you laid out

A terrain query answers where the ground is. It does not answer whether the place reads.

1. `inspectSubject({ shot, subject })` opens one named space, landmark, or instance set on its own, and a named space is sectioned automatically. Read `SUBJECT_INSPECTION` first.
2. `captureTurntable({ asset })` opens every model the world places, because a landmark nobody opened alone is a landmark nobody checked.
3. `prepareReview` and `submitReview` under `REVIEW_SUBJECT` for one authored place, and under `REVIEW_SHOT` for how it reads from the camera that shows it.
