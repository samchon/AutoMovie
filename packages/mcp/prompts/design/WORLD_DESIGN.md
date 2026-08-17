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

The site is built with named engine calls rather than with hand-written records, and those calls are reachable from the module a shot imports. `worldTerrain(` builds one flat terrain primitive from an explicit world-XZ footprint. `worldRamp(` builds a rectangular ramp from a centre line and an explicit rise, which is the piece a figure walks up. `worldBlock(` builds one box-proxy wall or building from a grounded base and a size, and hands back three things together: the registered primitive recipe, the static scene node that uses it, and the exact axis-aligned volume it occupies. The volume matters because it is what another placement is checked against, and a volume derived a second time from the transform you wrote is a chance to disagree with the thing that was drawn. `worldGrid(`, `worldScatter(`, and `worldAlongRoute(` turn one prototype plus a layout rule into a compact instance set: a rectangular field, a seeded disk scatter, or a run along a route, each returning the caller's own parameters rather than an expansion of them. `assertWorldPlacements(` refuses material contradictions between blocks, surfaces, routes, and landmarks before a shot is built, which is the one call in this family that exists to stop work rather than to produce it.

`worldHeightfield` is the exception, and the reason is worth knowing before you reach for it: it samples a height function, a function cannot cross the sandbox boundary, and a copy of the sampling math inside the sandbox would be a second implementation to disagree with the first. Derive a sampled heightfield in a project script and import the result as data; `DERIVED_ARTIFACTS` owns that path.

Read the ground back through the same record. `worldSurfaceHeight(` answers the height under one XZ point, which is what a placement, a contact, and a support sweep all measure against.

OpenUSD composition is a useful mental model for complex external worlds: references and payloads let assets compose without destructive copying, while variant sets preserve explicit alternatives. Regardless of format, register exact source, license, digest, conversion, and chosen variant in AutoMovie ownership.

## Environmental storytelling

Let the world show prior action, use, culture, logistics, weather, and conflict through wear, orientation, debris, routes, defenses, vegetation, sound, and light. Repetition establishes a system; one deliberate exception directs attention. Keep hero landmarks distinct in silhouette and value so they remain useful to both characters and camera.

## Atmosphere and effects

Fog, smoke, dust, rain, fire, and crowds need spatial and temporal bounds. They may reveal scale, hide transitions, carry wind, or change visibility, but they must not erase required subjects or acceptance evidence. Treat effects as authored systems with source, lifetime, region, density, and delivery cost.

## Cloth, planting, and water

Cloth, planting, and water sit beside architecture rather than inside it, and each has the same two-record shape: a free-standing computational domain, plus a building-owned binding that says which logical space holds it. A production world with no building at all uses the domain and simply writes no binding. Making the solver a child of the building would make the same cloth two different things depending on who owns the frame.

Cloth is a fixed-lattice, fixed-step position-based solve: particles at lattice sites with distance constraints along rows, columns, diagonals, and second neighbours resisting stretch, shear, and fold. The authored configuration is cloth at rest, so every constraint takes its rest length from the authored positions and an undisturbed panel with no gravity, no wind, and unmoved anchors produces exactly zero correction however long it integrates. It is a bounded first tier and says so: not a finite-element shell, no cloth-on-cloth contact, no friction or drag anisotropy, and the CPU reference state is the only normative one. The furnishing binding names the environment, the space, the domain, the elements the panel is fixed to, a `rest` or `simulated` mode, and which named anchor state to hold. Open and closed are chosen there: the furnishing selects a boundary condition and the solver finds the folds.

Planting is a parametric branching law with a growth stage in `[0, 1]`, a pruning envelope, and a foliage rule, all derived deterministically from a seed. There is no species catalogue and there will not be one: a fern, a ficus, a wall of ivy, and an aquatic reed differ by branching angles, ratios, direction, and leaf density, not by a name the engine would have to recognise. Growth is a state rather than an animation, so the same plant at the same stage is the same plant on every machine. Branch directions are authored as vectors rather than angles, so nothing transcendental touches a coordinate and a plant does not land differently on Windows and POSIX. A cluster arranges many plants; an installation binds a cluster to a space with what it stands on, hangs from, or is trained against, and how it is watered. A `null` irrigation is a legitimate authoring state, not a silent pass: a dry binding is exactly what a service-coordination pass needs to see.

Water is a fixed-grid, fixed-step shallow-water field: a per-cell depth over a per-cell bed plus horizontal face velocities. The authored state is water at rest, and motion comes from what the water cannot be in equilibrium with, an uneven free surface, a declared source or drain, an open rim, so nobody has to invent an initial velocity field. It is a bounded first tier too: no arbitrary 3D solve, no breaking waves, no vertical recirculation, no surface tension, and the CPU reference state is normative. The water-feature binding names the basin space, the rim boundaries retaining the water, a surface material, and a `static`, `flowing`, or `simulated` mode, where `static` is the authored step-zero state a mirror pool needs in order to read identically in every frame of a cut. Spray is a separate bounded particle budget on top of the field.

Each of them carries a declared budget and produces a state digest. Cloth and water are stepped, so a state is seekable to an exact step and two seeks of the same step agree; planting is not stepped at all, and its state is a pure function of its growth stage. Check the budget before the shot, compare the digest across machines, and never claim a simulated result from a domain you ran in a rest or static mode.

## Look at the world you laid out

A terrain query answers where the ground is. It does not answer whether the place reads.

1. `inspectSubject({ shot, subject })` opens one named space, landmark, or instance set on its own, and a named space is sectioned automatically. Read `SUBJECT_INSPECTION` first.
2. `captureTurntable({ asset })` opens every model the world places, because a landmark nobody opened alone is a landmark nobody checked.
3. `prepareReview` and `submitReview` under `REVIEW_SUBJECT` for one authored place, and under `REVIEW_SHOT` for how it reads from the camera that shows it.
