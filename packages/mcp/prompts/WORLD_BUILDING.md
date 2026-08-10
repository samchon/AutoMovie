# World Building Handbook

A world is a system of meaningful places, routes, constraints, and environmental cues. Decorative density is not world design. Begin with the actions and spatial decisions the screenplay requires, then build enough terrain and landmarks to make those decisions readable.

## World and building are different owners

The production world owns terrain, parks, streets, natural lakes, sky, weather, and the placement of buildings. An `IAutoMovieBuiltEnvironment` owns one work: its interiors, facade, roof, balcony, exterior stair, ladder, rail, skybridge, and helipad. Do not put the surrounding site into the building merely because it appears in the same frame. Sun, sky, season, orientation, reference ground, and neighbouring occluder masses are read-only context a daylight study reads from the world; the building record has no field for them, so they cannot enter its models, set pieces, or spaces.

One work holds one or more building units. `buildings` is the root table, and each entry names one unit's root element and root logical space. That element root is also the unit's coordinate root, so a second unit is moved, turned, or tilted as a whole without a single child transform being rewritten. Ownership is total: every element and every space descends from exactly one unit's roots, and a graph with an unowned root is refused. A sky-bridge is not a third unit; it is a work-owned connector whose two ends land in two different units.

Architecture has two linked graphs. `elements` is the visible parent-local full-TRS assembly; `spaces` is the logical partition used by story, placement, containment, and traversal. A continuous hall may still have separately named rooms, storeys, an attic, mezzanine, and double-height void. A storey is one `kind` string beside `mezzanine`, `duplex`, `attic`, `void`, and `roof-deck`; it is never the root of the hierarchy, and one duplex space may own two slabs while one hall holds a mezzanine inside its own air. A non-convex region is written as the convex cells it splits into, and an element that belongs to the unit rather than to any room (a curtain wall, a facade ladder) names no space at all. Boundaries/openings say what separates them, while connectors explicitly join them as passage, stair, ramp, lift, ladder, or bridge. Style and historical era are not schema variants: ancient masonry, a medieval hall, a modern apartment, and a speculative tower are different code and models assembled through the same open element kinds.

Query the graph rather than re-deriving it. `builtEnvironmentContainsPoint` answers containment over a space and its descendants, `builtEnvironmentAdjacentSpaces` answers what is reachable, `builtEnvironmentSpaceConnectors` answers with what — the authored records, 3D routes intact — `builtEnvironmentSpaceSurfaces` answers which support patches a space carries and which of them are walkable, `builtEnvironmentSpaceNodes` answers which staged set nodes stand in it, and `builtEnvironmentBuildingOfSpace` answers which unit owns it. Automatic pathfinding is not part of this contract; the authored routes and connectors are, and they must not be flattened away.

Build a class with ordinary TypeScript loops and reusable functions. Its `design()` returns the structured building, and its `render()` calls `lowerBuiltEnvironment(this.design())`. The result owns generated models, derived set placements, per-region support spaces, and the original building record. Merge support spaces with `mergeAutoMovieSpaces` when a shot needs one stage space; do not transcribe the building into a second set array.

Fluid is a separate engine domain. An indoor pond, channel, fountain, or waterfall may cite a building logical-space id as its host, but the building does not own the solver. The same fluid contract must also work in a production world without a building.

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
