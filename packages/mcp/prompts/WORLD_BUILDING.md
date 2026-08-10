# World Building Handbook

A world is a system of meaningful places, routes, constraints, and environmental cues. Decorative density is not world design. Begin with the actions and spatial decisions the screenplay requires, then build enough terrain and landmarks to make those decisions readable.

## World and building are different owners

The production world owns terrain, parks, streets, natural lakes, sky, weather, and the placement of buildings. An `IAutoMovieBuiltEnvironment` owns one work: its interiors, facade, roof, balcony, exterior stair, ladder, rail, skybridge, and helipad. Do not put the surrounding site into the building merely because it appears in the same frame. Sun, sky, season, orientation, reference ground, and neighbouring occluder masses are read-only context a daylight study reads from the world; the building record has no field for them, so they cannot enter its models, set pieces, or spaces.

One work holds one or more building units. `buildings` is the root table, and each entry names one unit's root element and root logical space. That element root is also the unit's coordinate root, so a second unit is moved, turned, or tilted as a whole without a single child transform being rewritten. Ownership is total: every element and every space descends from exactly one unit's roots, and a graph with an unowned root is refused. A sky-bridge is not a third unit; it is a work-owned connector whose two ends land in two different units.

Architecture has two linked graphs. `elements` is the visible parent-local full-TRS assembly; `spaces` is the logical partition used by story, placement, containment, and traversal. A continuous hall may still have separately named rooms, storeys, an attic, mezzanine, and double-height void. A storey is one `kind` string beside `mezzanine`, `duplex`, `attic`, `void`, and `roof-deck`; it is never the root of the hierarchy, and one duplex space may own two slabs while one hall holds a mezzanine inside its own air. A non-convex region is written as the convex cells it splits into, and an element that belongs to the unit rather than to any room (a curtain wall, a facade ladder) names no space at all. Boundaries/openings say what separates them, while connectors explicitly join them as passage, stair, ramp, lift, ladder, or bridge. Style and historical era are not schema variants: ancient masonry, a medieval hall, a modern apartment, and a speculative tower are different code and models assembled through the same open element kinds.

Query the graph rather than re-deriving it. `builtEnvironmentContainsPoint` answers containment over a space and its descendants, `builtEnvironmentAdjacentSpaces` answers what is reachable, `builtEnvironmentSpaceConnectors` answers with what — the authored records, 3D routes intact — `builtEnvironmentSpaceSurfaces` answers which support patches a space carries and which of them are walkable, `builtEnvironmentSpaceNodes` answers which staged set nodes stand in it, and `builtEnvironmentBuildingOfSpace` answers which unit owns it. Automatic pathfinding is not part of this contract; the authored routes and connectors are, and they must not be flattened away.

Build a class with ordinary TypeScript loops and reusable functions. Its `design()` returns the structured building, and its `render()` calls `lowerBuiltEnvironment(this.design())`. The result owns generated models, derived set placements, per-region support spaces, and the original building record. Merge support spaces with `mergeAutoMovieSpaces` when a shot needs one stage space; do not transcribe the building into a second set array.

Fluid is a separate engine domain. An indoor pond, channel, fountain, or waterfall may cite a building logical-space id as its host, but the building does not own the solver. The same fluid contract must also work in a production world without a building.

A set piece placed by a building carries a full `rotation` quaternion instead of the simpler `facingDeg` heading, which is what makes a sloped roof plane, a raking strut, a canted mullion, or a spiral flight expressible at all. Declare one or the other; carrying both is refused rather than resolved in an order nobody agreed on. Read `GEOMETRY` for the mesh constructors a building's own parts are built from, and `WORLD_DESIGN` for the instance sets a repeated part is placed through.

The starter ships worked examples under `src/examples/`: a building assembled by loops, a physically-based finish and its image bindings, props declaring placement relations, a seeded instance set, an observed plan that is read rather than traced, and a renovation phased over identities the building already published. Read the one nearest your problem before writing a new pattern; they are examples of technique, not a content library to copy into a production.

## Finishes: substance, surface, and build-up

Three records answer three different questions, and collapsing them is what makes a wall lie about itself.

A surface answers what the material looks like: base colour, roughness, maps. A substance answers what it is made of: an open classification, and density, thermal conductivity, specific heat, sound absorption, vapour resistance, and service life, each optional and each `null` until measured. `null` is the honest state for a production that never ran a study, and it is what keeps an analysis from being fed a number nobody measured. One substance may be shown by different surfaces (the same stone polished and flamed), and one surface may stand in for different substances, which is exactly why they are not one record.

An assembly answers how thick the thing actually is. It is an ordered stack of layers on one host: each layer names an open construction `role`, whether it is a `solid`, a `cavity`, or a `membrane`, its thickness in metres, its substance, whether it is the visible `finish`, and whether it `wrapsOpening`. The stack is measured rather than drawn: an `axis`, a `sense`, and an `offset` say which host-local direction the layers advance along and where the first face sits, so one build-up is stated once and applied to a wall, a floor, and a soffit. `faces` declares whether each end is `exposed` or `concealed`, which is how a missing finish and a wasted one are both caught: an exposed end must be finished, a concealed end must not be, a finish buried behind another layer is a defect, and a second finish over the first is another.

The build-up, not the colour, is what sets a wall's overall thickness and the depth of a window reveal. A layer that wraps narrows the finished opening on every side and lines the jamb to its own depth; a layer that stops at the jamb does neither, and a wrapping layer cannot turn the corner from behind one that already stopped. At a junction between two build-ups, layers are matched by `role`, so the same word has to mean the same thing on both sides or the wrong layers continue. The engine ships no substances and no build-ups. A catalogue of real-world materials is content, and content is yours.

## Repeated modules on a surface

Tiles, bricks, stone slabs, boards, panels, and repeated ornament are not a texture repeat. A texture repeat knows nothing about the real module size, the joint between modules, the piece cut at a boundary, the opening the pattern steps around, or how many modules were consumed and how much was thrown away. A surface pattern is the program that knows all of it: you write the module law per zone, and the engine owns everything that must be identical on every run.

Declare the pattern over one host face: zones each with their own module program and reach, exclusions no module may cover, the nominal `joint` and the slack a measured gap may differ from it by, the `adjacency` distance at which two pieces still count as neighbours, the smallest acceptable surviving fraction of a module, an optional grain tolerance in degrees, a seed, and how many variants the seed may choose between. Several zones in one pattern is how a transition is expressed, and the neighbour scan measures across the border between zones exactly as it does inside one.

Read the results rather than the render. Findings come back as `sliver`, `unsupported-piece`, `module-overlap`, `joint-deviation`, and `grain-break`, each naming the occurrence ids involved, the measured quantity, and the limit it failed. Quantities come back as placed, whole, and cut counts with covered area, consumed area (a cut piece still costs a whole module), waste area and ratio, net region area, and joint area and length, per zone and in total. That is the take-off somebody orders material from, so a pattern that renders beautifully and wastes forty percent is a pattern you can now see is wrong.

Whole occurrences are emitted as exact instance transforms and cut ones are listed separately, because a cut piece needs its own geometry and cannot share a prototype. Feed the whole ones into an `explicit` instance set and give the cut ones real meshes.

## Service networks and wet zones

Water, drainage, power, data, air, fire suppression, and control are one computational object, not seven. A service network holds systems, nodes carrying typed ports, segments joining exactly two ports, penetrations where a run crosses a boundary, and wet zones. Giving each discipline its own record would make "is this connected" seven questions with seven answers.

A system is the smallest thing that can be asked whether everything on it is fed: one discipline from `plumbing`, `drainage`, `electrical`, `data`, `hvac`, `fire`, or `control`; one medium the discipline permits; the unit every capacity and demand is stated in (`cubic-meter-per-second`, `watt`, `ampere`, `bit-per-second`, `dimensionless`); a `flow` of `from-root`, `to-root`, or `undirected`; the node it is rooted at; and a design capacity the declared demands are summed against. Cold water off one riser, the recirculating hot leg, one lighting circuit, one supply trunk, and the sprinkler main are five systems.

A node is a `source`, `fixture`, `equipment`, `terminal`, `junction`, or `valve`, and it is authored by the production with the ports it actually has. There is no fixture library, no pipe schedule, and no equipment model here, and there will not be: a basin, a sprinkler head, and a distribution panel are your nodes. What the record owns is the part a render that merely looks plumbed cannot prove. Every port is joined to something, the medium and unit agree end to end, a run crossing a boundary declares the sleeve it passes through and whether that annulus was made good, two disciplines do not occupy the same cubic metre, and the space a panel needs in order to be opened stays clear.

A wet zone binds a logical space to a `dry`, `damp`, `wet`, or `immersed` grade and states the membrane boundaries it covers, how far the membrane turns up beyond the floor, the fall of the floor as a rise-over-run ratio, the drains it falls to, and the thresholds where it hands over to a drier region. Those are the facts a leak is found in and none of them are visible in a still frame. A `wet` or `immersed` zone with a zero slope is water standing where it lands, and an unsealed sleeve through a membrane is a leak the render cannot show. A drainage run that ends in a floor gully composes the fluid domain below rather than inventing a second model of moving water.

## Environmental analysis

An analysis reads the design and the site; it never writes either. The site is the production's `environmentContext`: north, a reference ground plane, the environmental instants it wants answered, and neighbouring occluder masses. Ids there may not collide with the building's own, and no lowering, scene graph, or take-off ever emits that context as part of the work.

An analysis run names a domain from the closed set `daylight`, `artificial-light`, `thermal`, `moisture`, `air`, `acoustic`, the subject it analysed, the design revision it read, its solver, a digest of its settings, and its outcome. The revision is what makes a result perishable: a run that read `r7` is evidence about `r7` and nothing else. The outcome is `solved`, `unsupported`, or `not-run`; a solved one carries at least one metric, an optional spatial sample field, and non-fatal warnings, and the other two carry a reason and a remedy instead of a fabricated number.

Every metric states its key, its unit, its measured value or `null`, its declared target and comparison direction or `null`, and a status. A target carries its unit beside its value, because 300 lux and 300 candela are different requirements and a bare number would let one clear the other. The five statuses are `meets`, `misses`, `untargeted` (a number exists but nobody said what good is), `unsupported` (no adapter), and `not-run` (an adapter exists but did not execute), and the last two carry a gap naming what is missing and the exact change that would produce a value.

The report is one row per domain plus a bounded gap list with the remainder counted, and its status cannot be cleared by silence. A required domain nobody answered, a run that read a superseded revision, and a metric no adapter could produce all land in the gaps and force `incomplete`. Report `unsupported` and `not-run` as they are. Naming a domain is not a claim that it is solved, a data structure is not a simulation, and an absent analysis reported as a pass is a false capability claim, which is worse than no analysis.

## Drawings, schedules, and quantities

A drawing is a question asked of the design, never a second copy of it. A view states a cut plane, a direction, a scale, a filter, and a pen; every line, area, and quantity comes from the building the view is applied to, so a sheet cannot disagree with the model the way a hand-drafted one does the moment either moves.

Four projections are two decisions, not four algorithms: where the cut plane is and which side survives. `plan` looks down and draws what the plane passes through as cut and what lies below as projected. `reflected-ceiling-plan` looks up and mirrors the page basis, so a coffer lands on the same page point it occupies in the plan, which is what "reflected" has always meant. `section` cuts on a vertical plane and keeps what is beyond it. `elevation` has no cut at all. The `discipline` label is open, because a filter a catalogue never anticipated must be expressible over the same design rather than as a new drawing type nobody can add.

A schedule is the same design counted instead of drawn. Rows are grouped by type with a deterministic mark assigned from canonical order rather than from an authored label, each row names a bounded sample of its members with the remainder counted, and the row counts sum to the design's own occurrence total. A schedule therefore cannot lose or invent a door.

A quantity report answers a closed subject list every time: space floor area, space volume, opening area, connector length, element count, opening count, and model occurrence count. A subject with nothing to measure reports a zero total over zero owners and says so, rather than vanishing and reading as a building with no openings. Every number carries a `basis`: `exact` for a convex polygon's area, `approximate` for a volume assembled from overlapping convex cells. Read the basis before you order anything; a report that printed both as plain numbers would be worse than one that printed neither. Contributors are bounded and what the bound left out is counted and summed rather than dropped, and a derivation the report could not perform is a stated gap.

Export a view to SVG when a human has to look at it. The SVG is a sidecar of the derived drawing, not a source; edit the design and derive again.

## Phases, variants, and change

A renovation, a staged build, and a design still choosing between two options are the same record. Lineage deliberately imports none of the graphs it annotates: it attaches to a bare id plus the open name of the graph that id came from (`element`, `space`, `opening`, `material-layer`, `service-port`, `instance-slot`, `asset`), so a fold that does not exist yet can be phased and impact-traced without this record gaining a field. Registering an identity is the whole act of opting a graph into lineage.

Keep the four lifecycle roles apart, and read them as classifications of the whole work rather than of a moment in it. What predates the work is `retained` when it survives and `demolished` when it does not; what the work installs is `new` when it survives and `temporary` when it is taken out again, which is how shoring, a hoarding, and a protection deck stay distinguishable from the building they protect. A wall taken down in the demolition phase is `demolished` for the entire work, including the phases where it is still standing. Ask a phase snapshot for the moment: it answers `pending`, `present`, or `removed`, and `pending` also covers a subject installed on a branch that neither precedes nor follows the phase, because inventing an order between independent branches would be a lie.

Phases are a graph of prerequisites, not a line. Variants are alternatives preserved side by side over their base revisions, and decisions are the open and settled comparisons between them, so "we considered the other stair and rejected it" is a record rather than a memory. Every derived artifact stamps the view it was computed under: the revision, the variant applied or null for the base design, the phase it depicts or null when it is phase-independent, and a digest of the lowering configuration. That stamp is what lets a drawing, a schedule, a take-off, or an analysis be caught reading a superseded design instead of quietly reporting last week, and what keeps two alternatives of the same sheet from being mistaken for one another.

## Cloth, planting, and water

Three deterministic domains sit beside architecture rather than inside it, and each has the same two-record shape: a free-standing computational domain, plus a building-owned binding that says which logical space holds it. A production world with no building at all uses the domain and simply writes no binding. Making the solver a child of the building would make the same cloth two different things depending on who owns the frame.

Cloth is a fixed-lattice, fixed-step position-based solve: particles at lattice sites with distance constraints along rows, columns, diagonals, and second neighbours resisting stretch, shear, and fold. The authored configuration is cloth at rest, so every constraint takes its rest length from the authored positions and an undisturbed panel with no gravity, no wind, and unmoved anchors produces exactly zero correction however long it integrates. It is a bounded first tier and says so: not a finite-element shell, no cloth-on-cloth contact, no friction or drag anisotropy, and the CPU reference state is the only normative one. The furnishing binding names the environment, the space, the domain, the elements the panel is fixed to, a `rest` or `simulated` mode, and which named anchor state to hold. Open and closed are chosen there: the furnishing selects a boundary condition and the solver finds the folds.

Planting is a parametric branching law with a growth stage in `[0, 1]`, a pruning envelope, and a foliage rule, all derived deterministically from a seed. There is no species catalogue and there will not be one: a fern, a ficus, a wall of ivy, and an aquatic reed differ by branching angles, ratios, direction, and leaf density, not by a name the engine would have to recognise. Growth is a state rather than an animation, so the same plant at the same stage is the same plant on every machine. Branch directions are authored as vectors rather than angles, so nothing transcendental touches a coordinate and a plant does not land differently on Windows and POSIX. A cluster arranges many plants; an installation binds a cluster to a space with what it stands on, hangs from, or is trained against, and how it is watered. A `null` irrigation is a legitimate authoring state, not a silent pass: a dry binding is exactly what a service-coordination pass needs to see.

Water is a fixed-grid, fixed-step shallow-water field: a per-cell depth over a per-cell bed plus horizontal face velocities. The authored state is water at rest, and motion comes from what the water cannot be in equilibrium with, an uneven free surface, a declared source or drain, an open rim, so nobody has to invent an initial velocity field. It is a bounded first tier too: no arbitrary 3D solve, no breaking waves, no vertical recirculation, no surface tension, and the CPU reference state is normative. The water-feature binding names the basin space, the rim boundaries retaining the water, a surface material, and a `static`, `flowing`, or `simulated` mode, where `static` is the authored step-zero state a mirror pool needs in order to read identically in every frame of a cut. Spray is a separate bounded particle budget on top of the field.

All three carry declared budgets and produce a state digest. Cloth and water are stepped, so a state is seekable to an exact step and two seeks of the same step agree; planting is not stepped at all, and its state is a pure function of its growth stage. Check the budget before the shot, compare the digest across machines, and never claim a simulated result from a domain you ran in a rest or static mode.

## Props in a building

A prop is a crude primitive proxy with rich meaning. The geometry stays simple boxes and cylinders while the physics body, the contact affordances, and a self-declared articulation carry what the engine validates. Articulation is the object-side counterpart of a character's skeleton and range of motion: the prop's own joint nodes, a profile whose limits bound them and whose drivers couple them (a handle that mirrors a hinge), and the binding that maps profile keys onto those nodes. A rigid prop leaves the whole articulation `null`.

A prop may cite `modelRef` when the drawn appearance is imported bytes, and that hatch buys the appearance alone. `origin` becomes `imported`, the sealed closure must be a rigid `gltf-static-v1` appearance mapping no humanoid bones and carrying well-formed digests over paths its own ledger covers, and the authored parts stay the deterministic proxy every geometric judgment is made against, which is how an imported chair keeps a seat face other props can be proven to rest on. A humanoid appearance is a performer and goes to the cast instead. Whether the reference resolves to a registration, and whether each digest matches bytes on disk, is the compiler's question, not the record's.

Placement is where a prop meets the building, and it cites ids rather than copying geometry. Six typed relations are available: `in-space`, `on-support`, `against-boundary`, `fill-opening`, `attached`, and `suspended`, each accepting only the target kinds it can mean. At most one `in-space` and one `fill-opening` may be declared, because a prop occupies one logical space and fills one passage; the rest may repeat, so a cabinet may stand against two walls and a rail may socket into three posts. Authored order never changes the outcome, and a relation may cite a prop declared later.

State a `footprint` when the volume that matters is not the volume you modelled: a chair needs the room its seat sweeps back into, and a decorative overhang that is nobody's obstacle should be trimmed out. Leave it `null` to derive the exact bound of the prop's own parts, which is the honest default. `clearance` boxes are the keep-out volumes a door leaf, a drawer, a service panel, or a person using the thing needs, and they are checked against other props and against the passages the building declares, so a wardrobe that blocks a doorway or a bench that blocks a stair is a refusal rather than something a reviewer has to notice in a frame.

## Culling by room

A building's own space graph answers what the camera can possibly see, and the rule is one sentence: a space is hidden only when it is proved unreachable from the camera through every opening, connector, and exterior route the design declares. Everything else stays drawn. Aggressive culling trades a wrong frame for a faster one, and a wrong frame is not a cheaper frame, it is a different film. So an exterior camera hides nothing, a camera the design cannot place in exactly one space hides nothing, and a space whose extent was never stated hides nothing. The exterior is a node of the portal graph rather than the absence of one, which is why a sealed interior room still hides the other windowed rooms while a windowed room keeps them.

## Semantic layout

List stable anchors before generating detail:

- entrances, exits, objectives, threats, refuges, observation points, and horizon features;
- routes with width, slope, surface, direction, and traversal class;
- regions with narrative function, material, vegetation, occupancy, and visibility;
- ground contacts and height references for every staged subject;
- light, weather, atmosphere, and effect bounds.

Give each anchor a stable id. Shot contracts and acceptance scenarios refer to meaning, not guessed coordinates. Coordinates remain deterministic engine facts derived from the authored world record.

## Scale and traversal

Choose world units from the production contract and verify human, vehicle, building, terrain, and formation scale together. A road wide enough in a map may fail when a formation, turning radius, camera, and occlusion are considered. Test travel distance, slope, clearance, reach, line of sight, and camera distance with engine queries outside the compile sandbox.

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

Inspect plan, eye-level, action-level, and camera views. Check ground contact, route continuity, landmark visibility, formation fit, camera clearance, scale, horizon, repetition artifacts, and whether the environment changes story interpretation. World beauty is subordinate to readable action and durable semantic joins.
