# Built Environment

One work, its interiors and its facade, written as a record the engine measures rather than as geometry somebody assembled. Read this before authoring a building, a room, an opening, a finish, a service run, or anything placed inside one.

The site the work stands on is not here. Terrain, routes, landmarks, and the placement of the building itself belong to `WORLD_DESIGN`. What a finished building is then read for, its analyses and its take-offs, belongs to `BUILDING_STUDIES`.

Four topics under this one are read when their own condition applies, and not before.

## [`BUILDING_FINISHES`](BUILDING_FINISHES.md)

Read when a surface has to carry a material. Owns substance, surface, and build-up, and the population of repeated modules that covers a field of one, plus how a finish is judged at the distance the shot actually uses.

## [`BUILDING_SERVICES`](BUILDING_SERVICES.md)

Read when the work carries a system rather than only rooms. Owns water, drainage, power, data, air, fire suppression, and control as one graph of systems, nodes, segments, and penetrations, and the wet zones a building grades.

## [`BUILDING_PROPS`](BUILDING_PROPS.md)

Read when something is placed inside the work. Owns placement relations, the support and overlap queries that answer whether a thing rests where you meant, and the frame that shows whether the room reads as furnished.

## [`BUILDING_STUDIES`](BUILDING_STUDIES.md)

Read when a finished work is read back rather than authored. Owns environmental analysis and the drawings, schedules, and quantities derived from the record, both from a project script, and the rule that a number the picture contradicts is a fault in the record.

## World and building are different owners

The production world owns terrain, parks, streets, natural lakes, sky, weather, and the placement of buildings. An `IAutoMovieBuiltEnvironment` owns one work: its interiors, facade, roof, balcony, exterior stair, ladder, rail, skybridge, and helipad. Do not put the surrounding site into the building merely because it appears in the same frame. Sun, sky, season, orientation, reference ground, and neighbouring occluder masses are read-only context a daylight study reads from the world; the building record has no field for them, so they cannot enter its models, set pieces, or spaces.

One work holds one or more building units. `buildings` is the root table, and each entry names one unit's root element and root logical space. That element root is also the unit's coordinate root, so a second unit is moved, turned, or tilted as a whole without a single child transform being rewritten. Ownership is total: every element and every space descends from exactly one unit's roots, and a graph with an unowned root is refused. A sky-bridge is not a third unit; it is a work-owned connector whose two ends land in two different units.

Architecture has two linked graphs. `elements` is the visible parent-local full-TRS assembly; `spaces` is the logical partition used by story, placement, containment, and traversal.

A continuous hall may still have separately named rooms, storeys, an attic, mezzanine, and double-height void. A storey is one `kind` string beside `mezzanine`, `duplex`, `attic`, `void`, and `roof-deck`. It is never the root of the hierarchy, one duplex space may own two slabs, and one hall may hold a mezzanine inside its own air.

A space states its volume exactly one way. A non-convex region is written as the convex cells it splits into, or as a `shell`: one closed outward-wound triangle boundary whose inward-wound facets are voids, which is how an atrium punched clean through a storey stays one region instead of a decomposition somebody has to maintain. Stating both is refused.

Neither spelling has a curved primitive, so a dome or a vault is the flats it was written as and declares `fidelity: "faceted"` to say so. A take-off then reports that as its own gap rather than quoting facets as a curve.

An element that belongs to the unit rather than to any room, a curtain wall or a facade ladder, names no space at all. Boundaries and openings say what separates two spaces; connectors explicitly join them as passage, stair, ramp, lift, ladder, or bridge.

Style and historical era are not schema variants. Ancient masonry, a medieval hall, a modern apartment, and a speculative tower are different code and models assembled through the same open element kinds.

A repeated part is a population, not thousands of elements. Slate on a roof, ashlar in a wall, flagging on a floor, boards on a ceiling: write one entry in `populations`, pairing the logical space it stands in with the compact instance set that places every member, and `lowerBuiltEnvironment` hands that set to the world for you. The building then owns its own repeated parts, and one record states the placement law.

Name the smallest space that contains the whole field, and split a field crossing a room boundary into one population per room. That is two compact records, never two thousand member records.

A field covering the whole work names the work's own space, which is what makes "in this room" mean what stands in the room rather than what covers it: slate over a hall's ceiling belongs to the building, not to the hall.

Each population also declares `prototypeBounds`, the conservative model-local union of every selectable prototype. Refresh that union when a recipe or weighted prototype changes, and let `builtEnvironmentSpaceContentBounds` fold it through layout, heading, rotation, and scale rather than storing a second world box. Visibility variation never shrinks that declared placement envelope.

`along-route` is refused here, because a route is a world fact a building record has no field to reach.

Query the graph rather than re-deriving it. Every call below is on the sandbox surface so shot source can ask directly.

| Call | Answers |
| --- | --- |
| `builtEnvironmentContainsPoint(` | whether a point falls inside a space or any descendant |
| `builtEnvironmentAdjacentSpaces(` | what is reachable from a space |
| `builtEnvironmentSpaceConnectors(` | with what: the authored records, 3D routes intact |
| `builtEnvironmentSpaceBoundaries(` | what encloses or separates it: the boundary records whole, each with its `kind` and the elements realizing it |
| `builtEnvironmentSpaceSurfaces(` | which support patches a space carries, and which are walkable |
| `builtEnvironmentSpaceNodes(` | what stands in it: an element as `<environment>/<element>`, a whole population once as `instance-set:<set>` |
| `builtEnvironmentSpacePopulations(` | those population records, so a member regenerates from the set the renderer draws |
| `builtEnvironmentSpaceContentBounds(` | the world box all of it fills, null when nothing is placed at all |
| `builtEnvironmentElementBounds(` | that box for one named element, null for an undeclared id and for a transform-only node that draws nothing |
| `builtInstanceSetPlacementBounds(` | that box for one compact population, folded from its declared law so a field of thousands costs what a field of four costs |
| `builtEnvironmentSpaceFidelity(` | whether a subtree's volume is stated exactly, faceted, or not stated at all |
| `builtEnvironmentBuildingOfSpace(` | which unit owns it |

`builtEnvironmentElementBounds(` is the engine's single computation of an element's world extent. Placement checks and subject description both read it rather than repeating it.

That is every question this record answers about its own contents and extents. The ones that judge a placement against a support or a neighbour are under **Props in a building** below.

The sandbox capability-question index derives both families from the exported surface rather than from a count typed into a sentence. A question outside them is asked from a project script, not from shot source.

Place a hand-staged review or coverage camera from the content box, never from the declared cell. A room is routinely far larger than the thing standing in it, so a cell corner is often empty air facing a wall.

A shot that names one element as a required subject needs none of that arithmetic. The `frame` action measures that element's own geometry and stands where its width demands, and `CINEMATOGRAPHY` owns that solve. Reach for these boxes when you want a viewpoint the solve would not choose, or a number for a check rather than for a camera.

The content box counts populations as well as elements, which matters most exactly where it matters at all: a hall whose floor, walls, and ceiling are all fields would otherwise report the box of its furniture and aim your eye into a corner. A population contributes its authored `prototypeBounds` folded through its placement law, and the recipe's mesh is not in the building record, so do not invent a radius or store a second world box.

Automatic pathfinding is not part of this contract. The authored routes and connectors are, and they must not be flattened away.

Build a class with ordinary TypeScript loops and reusable functions. Its `design()` returns the structured building, and its `render()` calls `lowerBuiltEnvironment(this.design())`. The result owns generated models, derived set placements, per-region support spaces, and the original building record. Merge support spaces with `mergeAutoMovieSpaces(` when a shot needs one stage space; do not transcribe the building into a second set array.

Fluid is a separate engine domain. An indoor pond, channel, fountain, or waterfall may cite a building logical-space id as its host, but the building does not own the solver. The same fluid contract must also work in a production world without a building.

A set piece placed by a building carries a full `rotation` quaternion instead of the simpler `facingDeg` heading, which is what makes a sloped roof plane, a raking strut, a canted mullion, or a spiral flight expressible at all. Declare one or the other; carrying both is refused rather than resolved in an order nobody agreed on.

Read `GEOMETRY` for the mesh constructors a building's own parts are built from, `MODEL_RECIPE` for how an image is bound to a wall at its real size, and `WORLD_DESIGN` for the instance-set vocabulary (layout, count, seed, variation) a population's own `set` is written in.

The starter ships worked examples under `src/examples/`: a building assembled by loops, a physically-based finish and its image bindings, props declaring placement relations, a seeded instance set, an observed plan that is read rather than traced, and a renovation phased over identities the building already published. Read the one nearest your problem before writing a new pattern; they are examples of technique, not a content library to copy into a production. Two of them, `drawings.ts` and `services.ts`, demonstrate calls that belong to a project script rather than to shot source, so copy those into `scripts/` and not into `src/`; a later section says why.

## Settle the division before you dress it

Divide first, dress second, and take that order from the record rather than from taste. A boundary names the spaces it separates and the elements that realize it, an opening names the boundary it is cut through and the element that fills it, a connector names the spaces it stops at, and a support patch and a population each name the one space they stand in. `lowerBuiltEnvironment(` validates the whole record before it lowers anything and throws on the first reference that does not resolve, so contents are authored against a division that already exists, in that direction and no other.

The first pass is the whole division and nothing else. Settle the building units, cut the envelope into storeys and rooms, stand the exterior walls, the interior walls and the slabs, hang the doors and windows, land the stairs and lifts, then declare the support patches and which of them are walkable. Give every part of it a stable id you are willing to keep, because that id is what the second pass cites.

Close that pass with queries instead of a frame, because at this stage every question has a number for an answer and none of them needs a render. `builtEnvironmentContainsPoint(` says whether the place you call the middle of a hall is inside the hall. `builtEnvironmentAdjacentSpaces(` and `builtEnvironmentSpaceConnectors(` say whether a room adjoins and is reached by what the plan says it is. `builtEnvironmentSpaceBoundaries(` says what stands around it, which is a different question from what stands in it: a slab between two storeys belongs to neither room alone, so a room's contents legitimately exclude the ceiling above it and only the boundary records say what encloses it. Read each boundary whole. Its `kind` is an **open** label — one production spells a separation `interior-partition` and another spells it `wall` — so scanning for a fixed word finds zero and reports confidently; and an empty `elements` is a separation the design declares that nothing builds, which is an answer rather than a miss. `builtEnvironmentSpaceSurfaces(` says whether a room a performer walks through has a walkable patch under it. `builtEnvironmentSpaceFidelity(` says whether a subtree stated its volume at all, which every later camera, schedule and culling decision reads. A defect found here costs one edit; the same defect found after the finishes are on costs the finishes.

Then stop touching it. The second pass is per space and everything in it cites the first: a pattern zone is laid on a host face, a population is anchored in a space, a prop relation names an element, a boundary or an opening. Moving a wall afterwards re-cuts every zone, placement law and relation that named it, so the cheap correction and the expensive one are the same correction made a day apart. Work coarse to fine within the second pass too, one whole space at a time rather than one material across every space, so that a finished room is finished and the rooms behind it are visibly untouched.

## Where a building capability is called from

Your code runs in two places and they can call different things, so every capability below is worth reading twice: once for what it does, and once for where you are allowed to call it. A shot or film build function runs inside the deterministic compile sandbox. It may import only the engine names that sandbox publishes and it may not touch the filesystem, which is why `lowerBuiltEnvironment`, `mergeAutoMovieSpaces`, the `builtEnvironment*` queries and the mesh constructors are on that surface: they turn a building into a frame. `TYPESCRIPT` lists that surface in full, grouped by the question each family answers, so you can find a capability you did not already know the name of. A project script under `scripts/` runs in ordinary Node with the whole of `@automovie/engine` available and writes files. That is the second place, and everything that produces a document rather than a frame belongs to it.

Read the split as a question about the output rather than about difficulty. A drawing, a schedule, a take-off and a performance study are questions asked about a design; their answers are files you read, never bytes a renderer draws, and a build function that wrote one would not be deterministic any more. So `deriveAutoMovieDrawing`, `autoMovieDrawingToSvg`, `deriveAutoMovieDrawingSchedule`, `measureAutoMovieQuantities`, `lowerServiceNetwork`, `lowerWetZoneDrainage`, `analyzeAutoMovieDaylight`, `analyzeAutoMovieEnvelope`, `analyzeAutoMovieSpaceAir`, `analyzeAutoMovieAcoustics` and `summarizeAutoMovieAnalysis` are all script-side. Importing any of them into shot source is refused by name at compile time, and the refusal is the sandbox working rather than a bug to route around.

The starter ships that script. `npm run building:report` runs `scripts/deriveBuilding.ts`, which requires current compiler-owned state, reads every built environment, service network, fluid domain and water feature the compiled shots carry, and writes its sidecars under `reports/<building>/`. Reading generated state rather than your own modules is what makes a sheet a projection of the same bytes a frame was drawn from, and requiring the state to be current is what stops a document from describing a design that no longer exists. The studies the script asks for are declared in the script itself, because a workplane, a build-up's thermal conductivity, a surface's absorption and a supply flow are measured facts of your production and this repository ships neither a material catalogue nor climate data.

## Measure the passage, do not eyeball it

A connector is a declaration, and whether the stair it declares actually climbs its storey is a measurement. `builtConnectorGeometry` takes the environment and one connector id and answers the traversal: the signed `rise` from the first station to the last, the horizontal `run`, the total three-dimensional `length`, the `slope` in radians, and the ordered `stations` and `landings` themselves. `builtConnectorSectionAt` answers the section at one distance along that route, which is where a headroom or a width claim is checked rather than assumed. `builtConnectorCarriagePlacements` answers where the treads, the carriage, or the cabin actually land, optionally under one named operating state. `builtBoundaryWallCut` answers the cut one boundary carries, which is the same question asked of a wall rather than of a passage.

Read them because the alternative is your eyes. A stair whose slope is comfortable in a frame and wrong in metres is the defect this family exists to catch, and no capture shows it: two flights that differ by a fifth of a radian look like two stairs.

The four run in a project script under `scripts/`, where the whole engine is available. They read a compiled building, and a build function is the thing that produces one.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import { builtConnectorGeometry } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
for (const [shot, compiled] of state.generated.shots)
  for (const environment of compiled.builtEnvironments ?? [])
    for (const connector of environment.connectors) {
      const route = builtConnectorGeometry(environment, connector.id);
      console.log(
        shot,
        environment.id,
        connector.id,
        connector.kind,
        "rise",
        route.rise.toFixed(3),
        "run",
        route.run.toFixed(3),
        "slope deg",
        ((route.slope * 180) / Math.PI).toFixed(1),
        "stations",
        route.stations.length,
        "landings",
        route.landings.length,
      );
    }
```

## Phases, variants, and change

A renovation, a staged build, and a design still choosing between two options are the same record. Lineage deliberately imports none of the graphs it annotates: it attaches to a bare id plus the open name of the graph that id came from (`element`, `space`, `opening`, `material-layer`, `service-port`, `instance-slot`, `asset`), so a fold that does not exist yet can be phased and impact-traced without this record gaining a field. Registering an identity is the whole act of opting a graph into lineage.

Keep the lifecycle roles apart, and read them as classifications of the whole work rather than of a moment in it. What predates the work is `retained` when it survives and `demolished` when it does not; what the work installs is `new` when it survives and `temporary` when it is taken out again, which is how shoring, a hoarding, and a protection deck stay distinguishable from the building they protect. A wall taken down in the demolition phase is `demolished` for the entire work, including the phases where it is still standing. Ask a phase snapshot for the moment: it answers `pending`, `present`, or `removed`, and `pending` also covers a subject installed on a branch that neither precedes nor follows the phase, because inventing an order between independent branches would be a lie.

Phases are a graph of prerequisites, not a line. Variants are alternatives preserved side by side over their base revisions, and decisions are the open and settled comparisons between them, so "we considered the other stair and rejected it" is a record rather than a memory. Every derived artifact stamps the view it was computed under: the revision, the variant applied or null for the base design, the phase it depicts or null when it is phase-independent, and a digest of the lowering configuration. That stamp is what lets a drawing, a schedule, a take-off, or an analysis be caught reading a superseded design instead of quietly reporting last week, and what keeps two alternatives of the same sheet from being mistaken for one another.

## Culling by room

Culling is a capability rather than a product obligation. The requirement permits deciding visible and hidden spaces from rooms, openings, portals, and the camera's position, and binds one thing absolutely: nothing story-relevant, and no consumer of a reflection, a shadow, or a sound, may be dropped merely for being off screen. The render path draws the building it is given, so the saving is the production's to ask for rather than something already applied on your behalf.

`autoMovieRoomVisibility` is that answer. It takes the environment and the camera's world position and reports which of that building's spaces are visible, which are hidden, and the leaf space the camera resolved to. Read `inconclusive` before you read `hidden`: unresolved containment, or any one leaf space that states no extent, hides nothing at all in the whole building and says so there, rather than hiding a room nobody proved unreachable. Call it from a project script when you are deciding what a shot needs to stage, never as a substitute for the prohibition above: a saving that removes a reflection's source is not a saving.

The rule any culling obeys is one sentence: a space is hidden only when it is proved unreachable from the camera through every opening, connector, and exterior route the design declares. Everything else stays drawn. Aggressive culling trades a wrong frame for a faster one, and a wrong frame is not a cheaper frame, it is a different film. So an exterior camera hides nothing, a camera the design cannot place in exactly one leaf space hides nothing, and a space whose extent was never stated hides nothing. The exterior is a node of the portal graph rather than the absence of one, which is why a sealed interior room still hides the other windowed rooms while a windowed room keeps them. A boundary carrying an opening is a portal even when a door leaf fills it, because whether that leaf is shut is movable state, so a closed door widens no frame and hides nothing.

## Verification

Ask the model before you look at it. Most of what you want to know about a building is a number: what is in this room, does this rest on that, is this box where I meant it, does this space state a volume at all. Every one of those is answered by a query above or by the room schedule.

A query answers about the design; a frame answers about one camera pointed one way. Reaching for a render first is how a report of "the roof field is empty" gets written about a roof that is full.

A building also cannot be judged from outside, because the outside is what hides the inside, and a camera moved into a room shows that room only. Cut the resolved scene instead of moving the camera. `SUBJECT_INSPECTION` owns the section-plane vocabulary and the rule that geometry lying exactly on the plane is kept, which is what makes a cut taken at a floor level read as a plan of that storey. A section is an inspection viewpoint and never a delivery camera.

The same guide owns "what is this" and "what changed between these two revisions" over a compiled shot, which is how a building is compared with itself after a pass without opening a frame.

Then look. Take these four steps in order, and do not skip one because the step before it came back clean.

1. **Open every authored model on its own.** `captureTurntable({ asset })` captures the whole review-required set of one model recipe in one call: four horizontal quarters, the overhead outline, and a rigged model's extreme-range pose. An oriel that compiled to a single unit box, a polearm that is a headless shaft, a rack holding no weapons: each is obvious the moment the object is opened alone, and each survived an entire production because nobody opened it.
2. **Frame the fitting that is too small to read.** `captureFrame` takes a `part` on an asset target and narrows the camera onto one compiled part while the rest of the model stays in the shot. That is how a mullion, a hinge, a corbel, or a brace angle is judged instead of being inspected as forty pixels of a whole-model view.
3. **Open the room from inside.** `inspectSubject({ shot, subject })` draws one compiled subject from an inspection-owned turntable, and a named space is sectioned automatically. Read `SUBJECT_INSPECTION` first, because the tool refuses until this session has.
4. **Record the verdict where it outlives you.** Run `prepareReview` and `submitReview` under `REVIEW_SUBJECT` for one authored thing and under `REVIEW_ASSET` for a model recipe. An observation nobody submitted is an observation the next agent cannot read, and the compiler's review queue does not enumerate subjects, so asking for one is a decision you make rather than a gate that stops you.

Inspection images sit outside the render root and carry `deliveryEvidence: false`. They are how you decide what to fix, and never what a shot review accepts.

Then judge the shot views themselves: plan, eye level, action level, and the authored camera. Check ground contact, route continuity, landmark visibility, formation fit, camera clearance, scale, horizon, repetition artifacts, and whether the environment changes story interpretation. World beauty is subordinate to readable action and durable semantic joins.
