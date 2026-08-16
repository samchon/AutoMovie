# World Building Handbook

A world is a system of meaningful places, routes, constraints, and environmental cues. Decorative density is not world design. Begin with the actions and spatial decisions the screenplay requires, then build enough terrain and landmarks to make those decisions readable.

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

Close that pass with queries instead of a frame, because at this stage every question has a number for an answer and none of them needs a render. `builtEnvironmentContainsPoint(` says whether the place you call the middle of a hall is inside the hall. `builtEnvironmentAdjacentSpaces(` and `builtEnvironmentSpaceConnectors(` say whether a room adjoins and is reached by what the plan says it is. `builtEnvironmentSpaceSurfaces(` says whether a room a performer walks through has a walkable patch under it. `builtEnvironmentSpaceFidelity(` says whether a subtree stated its volume at all, which every later camera, schedule and culling decision reads. A defect found here costs one edit; the same defect found after the finishes are on costs the finishes.

Then stop touching it. The second pass is per space and everything in it cites the first: a pattern zone is laid on a host face, a population is anchored in a space, a prop relation names an element, a boundary or an opening. Moving a wall afterwards re-cuts every zone, placement law and relation that named it, so the cheap correction and the expensive one are the same correction made a day apart. Work coarse to fine within the second pass too, one whole space at a time rather than one material across every space, so that a finished room is finished and the rooms behind it are visibly untouched.

## Where a building capability is called from

Your code runs in two places and they can call different things, so every capability below is worth reading twice: once for what it does, and once for where you are allowed to call it. A shot or film build function runs inside the deterministic compile sandbox. It may import only the engine names that sandbox publishes and it may not touch the filesystem, which is why `lowerBuiltEnvironment`, `mergeAutoMovieSpaces`, the `builtEnvironment*` queries and the mesh constructors are on that surface: they turn a building into a frame. `TYPESCRIPT` lists that surface in full, grouped by the question each family answers, so you can find a capability you did not already know the name of. A project script under `scripts/` runs in ordinary Node with the whole of `@automovie/engine` available and writes files. That is the second place, and everything that produces a document rather than a frame belongs to it.

Read the split as a question about the output rather than about difficulty. A drawing, a schedule, a take-off and a performance study are questions asked about a design; their answers are files you read, never bytes a renderer draws, and a build function that wrote one would not be deterministic any more. So `deriveAutoMovieDrawing`, `autoMovieDrawingToSvg`, `deriveAutoMovieDrawingSchedule`, `measureAutoMovieQuantities`, `lowerServiceNetwork`, `lowerWetZoneDrainage`, `analyzeAutoMovieDaylight`, `analyzeAutoMovieEnvelope`, `analyzeAutoMovieSpaceAir`, `analyzeAutoMovieAcoustics` and `summarizeAutoMovieAnalysis` are all script-side. Importing any of them into shot source is refused by name at compile time, and the refusal is the sandbox working rather than a bug to route around.

The starter ships that script. `npm run building:report` runs `scripts/deriveBuilding.ts`, which requires current compiler-owned state, reads every built environment, service network, fluid domain and water feature the compiled shots carry, and writes its sidecars under `reports/<building>/`. Reading generated state rather than your own modules is what makes a sheet a projection of the same bytes a frame was drawn from, and requiring the state to be current is what stops a document from describing a design that no longer exists. The studies the script asks for are declared in the script itself, because a workplane, a build-up's thermal conductivity, a surface's absorption and a supply flow are measured facts of your production and this repository ships neither a material catalogue nor climate data.

## Finishes: substance, surface, and build-up

Substance, surface, and build-up answer different questions, and collapsing them is what makes a wall lie about itself.

A surface answers what the material looks like: base colour, roughness, maps. A substance answers what it is made of: an open classification, and density, thermal conductivity, specific heat, sound absorption, vapour resistance, and service life, each optional and each `null` until measured. `null` is the honest state for a production that never ran a study, and it is what keeps an analysis from being fed a number nobody measured. One substance may be shown by different surfaces (the same stone polished and flamed), and one surface may stand in for different substances, which is exactly why they are not one record.

An assembly answers how thick the thing actually is. It is an ordered stack of layers on one host: each layer names an open construction `role`, whether it is a `solid`, a `cavity`, or a `membrane`, its thickness in metres, its substance, whether it is the visible `finish`, and whether it `wrapsOpening`. The stack is measured rather than drawn: an `axis`, a `sense`, and an `offset` say which host-local direction the layers advance along and where the first face sits, so one build-up is stated once and applied to a wall, a floor, and a soffit. `faces` declares whether each end is `exposed` or `concealed`, which is how a missing finish and a wasted one are both caught: an exposed end must be finished, a concealed end must not be, a finish buried behind another layer is a defect, and a second finish over the first is another.

The build-up, not the colour, is what sets a wall's overall thickness and the depth of a window reveal. A layer that wraps narrows the finished opening on every side and lines the jamb to its own depth; a layer that stops at the jamb does neither, and a wrapping layer cannot turn the corner from behind one that already stopped. At a junction between two build-ups, layers are matched by `role`, so the same word has to mean the same thing on both sides or the wrong layers continue. The engine ships no substances and no build-ups. A catalogue of real-world materials is content, and content is yours.

## Repeated modules on a surface

Tiles, bricks, stone slabs, boards, panels, and repeated ornament are not a texture repeat. A texture repeat knows nothing about the real module size, the joint between modules, the piece cut at a boundary, the opening the pattern steps around, or how many modules were consumed and how much was thrown away. A surface pattern is the program that knows all of it: you write the module law per zone, and the engine owns everything that must be identical on every run.

Declare the pattern over one host face: zones each with their own module program and reach, exclusions no module may cover, the nominal `joint` and the slack a measured gap may differ from it by, the `adjacency` distance at which two pieces still count as neighbours, the smallest acceptable surviving fraction of a module, an optional grain tolerance in degrees, a seed, and how many variants the seed may choose between. Several zones in one pattern is how a transition is expressed, and the neighbour scan measures across the border between zones exactly as it does inside one.

Read the results rather than the render. Findings come back as `sliver`, `unsupported-piece`, `module-overlap`, `joint-deviation`, and `grain-break`, each naming the occurrence ids involved, the measured quantity, and the limit it failed. Quantities come back as placed, whole, and cut counts with covered area, consumed area (a cut piece still costs a whole module), waste area and ratio, net region area, and joint area and length, per zone and in total. These are film-facing design measurements for comparing the authored pattern with its declared limits; they are not a bill of materials, a procurement take-off, or an instruction to order anything. A pattern that renders beautifully and wastes forty percent is a pattern whose declared layout can now be reconsidered.

Whole occurrences are emitted as exact instance transforms and cut ones are listed separately, because a cut piece needs its own geometry and cannot share a prototype. Feed the whole ones into an `explicit` instance set and give the cut ones real meshes.

Inside a building that `explicit` set is a `populations` entry rather than a world set, so the room it covers can answer for it. A wall of ashlar and a roof of slate are each one population naming the smallest space that contains the field, and the pieces the pattern cut are ordinary elements in the same space. Placing the run's output straight into the production world instead would leave the building unable to say what stands in its own rooms, which is the failure the population record exists to prevent.

The whole pattern path is callable from shot source, so none of it needs a script. `generateAutoMovieSurfacePattern(` takes the pattern and answers with `placements`, `quantities` and `findings`. `autoMoviePatternInstanceTransforms(` turns that answer's whole occurrences into instance transforms and hands back the cut ids you still owe geometry for. `autoMoviePatternTextureTransforms(` says how each laid piece samples its material, and reports by id any piece whose lay would need a shear the texture matrix has no term for, rather than skewing the image quietly.

## Service networks and wet zones

Water, drainage, power, data, air, fire suppression, and control are one computational object rather than one record each. A service network holds systems, nodes carrying typed ports, segments joining exactly two ports, penetrations where a run crosses a boundary, and wet zones. Giving each discipline its own record would make "is this connected" a separate question with a separate answer for every discipline in the list.

A system is the smallest thing that can be asked whether everything on it is fed: one discipline from `plumbing`, `drainage`, `electrical`, `data`, `hvac`, `fire`, or `control`; one medium the discipline permits; the unit every capacity and demand is stated in (`cubic-meter-per-second`, `watt`, `ampere`, `bit-per-second`, `dimensionless`); a `flow` of `from-root`, `to-root`, or `undirected`; the node it is rooted at; and a design capacity the declared demands are summed against. Cold water off one riser, the recirculating hot leg, one lighting circuit, one supply trunk, and the sprinkler main are five systems.

A node is a `source`, `fixture`, `equipment`, `terminal`, `junction`, or `valve`, and it is authored by the production with the ports it actually has. There is no fixture library, no pipe schedule, and no equipment model here, and there will not be: a basin, a sprinkler head, and a distribution panel are your nodes. What the record owns is the part a render that merely looks plumbed cannot prove. Every port is joined to something, the medium and unit agree end to end, a run crossing a boundary declares the sleeve it passes through and whether that annulus was made good, two disciplines do not occupy the same cubic metre, and the space a panel needs in order to be opened stays clear.

A wet zone binds a logical space to a `dry`, `damp`, `wet`, or `immersed` grade and states the membrane boundaries it covers, how far the membrane turns up beyond the floor, the fall of the floor as a rise-over-run ratio, the drains it falls to, and the thresholds where it hands over to a drier region. Those are the facts a leak is found in and none of them are visible in a still frame. A `wet` or `immersed` zone with a zero slope is water standing where it lands, and an unsealed sleeve through a membrane is a leak the render cannot show. A drainage run that ends in a floor gully composes the fluid domain below rather than inventing a second model of moving water.

Declare the network from shot source, where it is validated with the building it serves, and draw it from a project script. `lowerServiceNetwork` sweeps a regular section along every authored centre line and refuses an invalid graph outright, because a picture of a working installation placed in front of the reason it does not work is the one outcome this record exists to prevent. `lowerWetZoneDrainage` turns a zone's own supply inlets and drains into the sources and sinks of the fluid domain standing in that room, which is how a floor that falls to a gully composes the water solver instead of describing water twice. A zone whose room holds no declared domain has nothing to drain into, and `npm run building:report` reports that as `not-run` rather than lowering an installation that appears to drain.

## Environmental analysis

An analysis reads the design and the site; it never writes either. The site is the production's `environmentContext`: north, a reference ground plane, the environmental instants it wants answered, and neighbouring occluder masses. Ids there may not collide with the building's own, and no lowering, scene graph, or take-off ever emits that context as part of the work.

An analysis run names a domain from the closed set `daylight`, `artificial-light`, `thermal`, `moisture`, `air`, `acoustic`, the subject it analysed, the design revision it read, its solver, a digest of its settings, and its outcome. The revision is what makes a result perishable: a run that read `r7` is evidence about `r7` and nothing else. The outcome is `solved`, `unsupported`, or `not-run`; a solved one carries at least one metric, an optional spatial sample field, and non-fatal warnings, and the other two carry a reason and a remedy instead of a fabricated number.

Every metric states its key, its unit, its measured value or `null`, its declared target and comparison direction or `null`, and a status. A target carries its unit beside its value, because 300 lux and 300 candela are different requirements and a bare number would let one clear the other. The statuses are `meets`, `misses`, `untargeted` (a number exists but nobody said what good is), `unsupported` (no adapter), and `not-run` (an adapter exists but did not execute), and the last two carry a gap naming what is missing and the exact change that would produce a value.

The report is one row per domain plus a bounded gap list with the remainder counted, and its status cannot be cleared by silence. A required domain nobody answered, a run that read a superseded revision, and a metric no adapter could produce all land in the gaps and force `incomplete`. Report `unsupported` and `not-run` as they are. Naming a domain is not a claim that it is solved, a data structure is not a simulation, and an absent analysis reported as a pass is a false capability claim, which is worse than no analysis.

The solvers answer those domains and one fold rolls them up, and every one of them is called from a project script: `analyzeAutoMovieDaylight` for `daylight` and `artificial-light`, `analyzeAutoMovieEnvelope` for `thermal` and `moisture` as two runs of one build-up, `analyzeAutoMovieSpaceAir` for `air`, `analyzeAutoMovieAcoustics` for `acoustic`, and `summarizeAutoMovieAnalysis` for the report over them. Each takes one request naming the subject, the revision it read, and the measured inputs the study needs; `npm run building:report` supplies the run id, the revision and the site, and the study itself is yours to declare. A production that declares no study runs none, and the sidecar records that gap rather than an empty verdict that would read as a pass.

## Drawings, schedules, and quantities

A drawing is a question asked of the design, never a second copy of it. A view states a cut plane, a direction, a scale, a filter, and a pen; every line, area, and quantity comes from the building the view is applied to, so a sheet cannot disagree with the model the way a hand-drafted one does the moment either moves.

The projections are two decisions rather than an algorithm apiece: where the cut plane is and which side survives. `plan` looks down and draws what the plane passes through as cut and what lies below as projected. `reflected-ceiling-plan` looks up and mirrors the page basis, so a coffer lands on the same page point it occupies in the plan, which is what "reflected" has always meant. `section` cuts on a vertical plane and keeps what is beyond it. `elevation` has no cut at all. The `discipline` label is open, because a filter a catalogue never anticipated must be expressible over the same design rather than as a new drawing type nobody can add.

A schedule is the same design counted instead of drawn. It counts one subject per run, `space`, `opening` or `connector`. The mark on every row is assigned from canonical order rather than from an authored label, each row names a bounded sample of its members with the remainder counted, and the row counts sum to the design's own occurrence total. A schedule therefore cannot lose or invent a door.

Ask your project script for the room schedule first, and ask it rather than building an index of your own. `space` groups differently from the other subjects on purpose: an opening schedule collapses three hundred identical doors into one type row, while a room is its own row, because two rooms alike in every column are still two rooms somebody has to visit. Each room row carries a `place`: the building unit that owns it, its parent space, the declared cell and the measured content box kept apart, volume fidelity, what stands in it, what it adjoins and what connects to it. Every one of those is the built environment's own query rather than a second derivation, so the schedule cannot disagree with the model it is a reading of.

`contents` is read from declared membership, which is the only reading that is right. An element and a population each state the one space they occupy, so the row names an element as `<environment>/<element>` and a whole population once as `instance-set:<set>`, bounded like any sample with `omittedContents` carrying the rest. Matching an id prefix against the model answers a different question and answers it low: a field authored as one compact set contributes nothing to a name scan, and a room whose floor, walls and ceiling are populations reads as nearly empty while being the fullest room in the building. If you are about to grep ids to learn what is in a room, this row is the thing you were about to write.

Read the two boxes as two facts. `declared` is how far the zone reaches and `content` is where its contents actually are; a room is routinely far larger than the thing standing in it, so a camera derived from the declared cell frames a wall. A space that states no volume, or one whose cells no box can bound, is `unmeasured` with null dimensions and a stated gap, and its contents are measured either way, because a purely semantic container full of things is not an empty one. What the row does not carry is stated too: finish, furniture, fixture, equipment, light and service terminal are not scheduled subjects, and an absent finish row is not an unfinished room. An opening and a connector row carry no `place` at all yet and say so as a gap, so their location is still read from the design.

A quantity report answers a closed subject list every time: space floor area, space volume, opening area, connector length, element count, opening count, and model occurrence count. A subject with nothing to measure reports a zero total over zero owners and says so, rather than vanishing and reading as a building with no openings. Every number carries a `basis`: `exact` for a footprint's area, `approximate` for a volume assembled from overlapping convex cells. A support patch's floor area is its outer ring less its holes, so an atrium void is floor nobody pours rather than floor somebody orders. Read the basis before you order anything; a report that printed both as plain numbers would be worse than one that printed neither. Contributors are bounded and what the bound left out is counted and summed rather than dropped, and a derivation the report could not perform is a stated gap.

Every one of these derivations runs from a project script and never from shot source. `deriveAutoMovieDrawing` takes one environment and one view; `deriveAutoMovieDrawingSchedule` takes one environment and one subject, and counts its rooms, openings or connectors off the same graph; `measureAutoMovieQuantities` answers the closed subject list; and `autoMovieDrawingToSvg` exports a view when a human has to look at it, refusing a drawing serialized with a different view's pen. The SVG is a sidecar of the derived drawing, not a source; edit the design and derive again. `npm run building:report` performs every one of them over every building the compiled shots carry and writes the sheets beside the record they came from.

There are disciplines this derivation cannot serve, and it says so on every sheet rather than on none. `deriveAutoMovieDrawing` is handed the built environment alone, so a services view draws no segment, port or penetration even where a network is authored, and a finish plan hatches no layer order, thickness or coursing even where an assembly is. Both come back as the `service-network` and `material-build-up` gaps, `unsupported` rather than `not-run`, because what is missing is the derivation and not your input. Ask for those sheets anyway and read their gaps: a discipline label is a filter over one model, never a second model, and a sheet that looked complete while the pipework lived somewhere else is how a coordination failure reaches site.

## Phases, variants, and change

A renovation, a staged build, and a design still choosing between two options are the same record. Lineage deliberately imports none of the graphs it annotates: it attaches to a bare id plus the open name of the graph that id came from (`element`, `space`, `opening`, `material-layer`, `service-port`, `instance-slot`, `asset`), so a fold that does not exist yet can be phased and impact-traced without this record gaining a field. Registering an identity is the whole act of opting a graph into lineage.

Keep the lifecycle roles apart, and read them as classifications of the whole work rather than of a moment in it. What predates the work is `retained` when it survives and `demolished` when it does not; what the work installs is `new` when it survives and `temporary` when it is taken out again, which is how shoring, a hoarding, and a protection deck stay distinguishable from the building they protect. A wall taken down in the demolition phase is `demolished` for the entire work, including the phases where it is still standing. Ask a phase snapshot for the moment: it answers `pending`, `present`, or `removed`, and `pending` also covers a subject installed on a branch that neither precedes nor follows the phase, because inventing an order between independent branches would be a lie.

Phases are a graph of prerequisites, not a line. Variants are alternatives preserved side by side over their base revisions, and decisions are the open and settled comparisons between them, so "we considered the other stair and rejected it" is a record rather than a memory. Every derived artifact stamps the view it was computed under: the revision, the variant applied or null for the base design, the phase it depicts or null when it is phase-independent, and a digest of the lowering configuration. That stamp is what lets a drawing, a schedule, a take-off, or an analysis be caught reading a superseded design instead of quietly reporting last week, and what keeps two alternatives of the same sheet from being mistaken for one another.

## Cloth, planting, and water

Cloth, planting, and water sit beside architecture rather than inside it, and each has the same two-record shape: a free-standing computational domain, plus a building-owned binding that says which logical space holds it. A production world with no building at all uses the domain and simply writes no binding. Making the solver a child of the building would make the same cloth two different things depending on who owns the frame.

Cloth is a fixed-lattice, fixed-step position-based solve: particles at lattice sites with distance constraints along rows, columns, diagonals, and second neighbours resisting stretch, shear, and fold. The authored configuration is cloth at rest, so every constraint takes its rest length from the authored positions and an undisturbed panel with no gravity, no wind, and unmoved anchors produces exactly zero correction however long it integrates. It is a bounded first tier and says so: not a finite-element shell, no cloth-on-cloth contact, no friction or drag anisotropy, and the CPU reference state is the only normative one. The furnishing binding names the environment, the space, the domain, the elements the panel is fixed to, a `rest` or `simulated` mode, and which named anchor state to hold. Open and closed are chosen there: the furnishing selects a boundary condition and the solver finds the folds.

Planting is a parametric branching law with a growth stage in `[0, 1]`, a pruning envelope, and a foliage rule, all derived deterministically from a seed. There is no species catalogue and there will not be one: a fern, a ficus, a wall of ivy, and an aquatic reed differ by branching angles, ratios, direction, and leaf density, not by a name the engine would have to recognise. Growth is a state rather than an animation, so the same plant at the same stage is the same plant on every machine. Branch directions are authored as vectors rather than angles, so nothing transcendental touches a coordinate and a plant does not land differently on Windows and POSIX. A cluster arranges many plants; an installation binds a cluster to a space with what it stands on, hangs from, or is trained against, and how it is watered. A `null` irrigation is a legitimate authoring state, not a silent pass: a dry binding is exactly what a service-coordination pass needs to see.

Water is a fixed-grid, fixed-step shallow-water field: a per-cell depth over a per-cell bed plus horizontal face velocities. The authored state is water at rest, and motion comes from what the water cannot be in equilibrium with, an uneven free surface, a declared source or drain, an open rim, so nobody has to invent an initial velocity field. It is a bounded first tier too: no arbitrary 3D solve, no breaking waves, no vertical recirculation, no surface tension, and the CPU reference state is normative. The water-feature binding names the basin space, the rim boundaries retaining the water, a surface material, and a `static`, `flowing`, or `simulated` mode, where `static` is the authored step-zero state a mirror pool needs in order to read identically in every frame of a cut. Spray is a separate bounded particle budget on top of the field.

Each of them carries a declared budget and produces a state digest. Cloth and water are stepped, so a state is seekable to an exact step and two seeks of the same step agree; planting is not stepped at all, and its state is a pure function of its growth stage. Check the budget before the shot, compare the digest across machines, and never claim a simulated result from a domain you ran in a rest or static mode.

## Props in a building

Placement support is an authored relation, not a guess from proximity. The subject is an element or a compact population; the support is either of those or an authored `surface`, which is evaluated through its own height rule rather than through a box. Declare `bearing` or `suspended`, then ask `builtEnvironmentSupportStatus(`. It answers `resting`, `floating`, `sunk`, `not-over-support` when nothing of the subject stands over the support at all, `suspended` for a declared hang, and `unresolved` naming which side failed to resolve. A bearing that lands over its support carries the signed underside `gap` in metres, so "floating" comes with how far; every other answer leaves `gap` null. Omitting `tolerance` uses the engine's own placement epsilon; a negative or non-finite one is refused rather than defaulted, because it withdraws the meaning of contact instead of adjusting it.

Read the `basis` before you believe the number. `element-geometry-bounds` measured the vertices the renderer draws and `surface-height-rule` evaluated an authored patch exactly, but `population-placement-bounds` is a conservative envelope over a whole field and `element-origin-point` measured no extent at all: the record states where that body stands and carries no vertices for it, as with a runtime model reference, so a `separate` or `floating` verdict taken from it is a claim about a point. `builtEnvironmentPlacementBounds(` resolves one element or population locator to that same box and basis, and `builtEnvironmentPlacementOverlap(` compares two named placements and reports each side's basis with the verdict. Populations keep their conservative prototype basis throughout and are never expanded into thousands of members. Keep unresolved identities and overlap findings explicit instead of inferring a support from labels or storing a second world box.

Run the check over the things you placed rather than over one you doubt, because it is cheap and a wrong answer is silent:

```ts
import { builtEnvironmentSupportStatus } from "@automovie/engine";
import type {
  AutoMovieBuiltPlacementBodyLocator,
  AutoMovieBuiltPlacementSupportLocator,
  IAutoMovieBuiltEnvironment,
} from "@automovie/interface";

/** One authored claim that a named body bears on a named support. */
export interface IBearingClaim {
  subject: AutoMovieBuiltPlacementBodyLocator;
  support: AutoMovieBuiltPlacementSupportLocator;
}

export const unsupportedBodies = (
  environment: IAutoMovieBuiltEnvironment,
  claims: readonly IBearingClaim[],
): string[] =>
  claims.flatMap((claim) => {
    const result = builtEnvironmentSupportStatus({
      environment,
      query: { ...claim, kind: "bearing" },
    });
    return result.status === "resting"
      ? []
      : [
          [
            claim.subject.kind,
            claim.subject.id,
            "on",
            claim.support.kind,
            claim.support.id,
            result.status,
            "gap",
            String(result.gap),
            "basis",
            String(result.subjectBasis),
          ].join(" "),
        ];
  });
```

A prop is a crude primitive proxy with rich meaning. The geometry stays simple boxes and cylinders while the physics body, the contact affordances, and a self-declared articulation carry what the engine validates. Articulation is the object-side counterpart of a character's skeleton and range of motion: the prop's own joint nodes, a profile whose limits bound them and whose drivers couple them (a handle that mirrors a hinge), and the binding that maps profile keys onto those nodes. A rigid prop leaves the whole articulation `null`.

A prop may cite `modelRef` when the drawn appearance is imported bytes, and that hatch buys the appearance alone. `origin` becomes `imported`, the sealed closure must be a rigid `gltf-static-v1` appearance mapping no humanoid bones and carrying well-formed digests over paths its own ledger covers, and the authored parts stay the deterministic proxy every geometric judgment is made against, which is how an imported chair keeps a seat face other props can be proven to rest on. A humanoid appearance is a performer and goes to the cast instead. Whether the reference resolves to a registration, and whether each digest matches bytes on disk, is the compiler's question, not the record's.

Placement is where a prop meets the building, and it cites ids rather than copying geometry. The typed relations are `in-space`, `on-support`, `against-boundary`, `fill-opening`, `attached`, and `suspended`, each accepting only the target kinds it can mean. At most one `in-space` and one `fill-opening` may be declared, because a prop occupies one logical space and fills one passage; the rest may repeat, so a cabinet may stand against two walls and a rail may socket into three posts. Authored order never changes the outcome, and a relation may cite a prop declared later.

Shot source may call `propAnchorFrame({ target: relation.target, environments, props, set })` to derive the prop's exact world position and rotation. Pass the current prop registry and staged set when the target is a prop affordance; `null` means the named target did not resolve. Keep that call in source so the same relation drives placement and validation; do not copy the returned frame into a second authored transform.

State a `footprint` when the volume that matters is not the volume you modelled: a chair needs the room its seat sweeps back into, and a decorative overhang that is nobody's obstacle should be trimmed out. Leave it `null` to derive the exact bound of the prop's own parts, which is the honest default. `clearance` boxes are the keep-out volumes a door leaf, a drawer, a service panel, or a person using the thing needs, and they are checked against other props and against the passages the building declares, so a wardrobe that blocks a doorway or a bench that blocks a stair is a refusal rather than something a reviewer has to notice in a frame.

## Culling by room

A building's own space graph answers what the camera can possibly see, and the rule is one sentence: a space is hidden only when it is proved unreachable from the camera through every opening, connector, and exterior route the design declares. Everything else stays drawn. Aggressive culling trades a wrong frame for a faster one, and a wrong frame is not a cheaper frame, it is a different film. So an exterior camera hides nothing, a camera the design cannot place in exactly one leaf space hides nothing, and a space whose extent was never stated hides nothing. The exterior is a node of the portal graph rather than the absence of one, which is why a sealed interior room still hides the other windowed rooms while a windowed room keeps them. A boundary carrying an opening is a portal even when a door leaf fills it, because whether that leaf is shut is movable state, so a closed door widens no frame and hides nothing.

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
