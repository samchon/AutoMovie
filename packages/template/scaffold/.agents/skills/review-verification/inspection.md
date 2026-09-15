# Inspecting compiled subjects

Use subject inspection after compilation to ask what one authored thing is and what it looks like, on its own, without staging a shot around it. Routes answer different halves of that. The numbers come from ordinary `@automovie/engine` queries over an `IAutoMovieSubjectArtifact`, which is one `IAutoMovieCompiledShotSource` paired with the revision you read it at. The pictures come from `inspectProductionSubject`, the project scripts this document gates.

Run inspection queries on the artifact or source result that you want to examine. Import them directly from `@automovie/engine`. Source functions and command modules inspect their explicit input and output values. Section planes are viewer inspection controls.

This ground is divided, and no document on it substitutes for another. This one answers what a compiled subject is, how two compiled artifacts differ, and what one subject looks like from an eye the inspection chose. The visual change report answers which already-rendered views moved between two revisions, as digests. A verdict is produced in the evidence citation on the source that claims the unit is realized, and no question answered here produces one.

## Choose the artifact and revision

Pass the exact typed source result and its revision to `describeAutoMovieSubjects` or `describeAutoMovieSubject` from `@automovie/engine`. Use the same producer as the viewer and delivery consumer. Record the input revision and invocation basis; a timestamp or a successful page load is not source identity.

## Enumerate, then address

`describeAutoMovieSubjects`, called with `{ revision, compiled }`, lists the directly stored subjects in stable order: prototypes, prototype parts, building elements, instance sets, and logical spaces. Building elements include the transform-only groups the builder stages no scene node for, because a group is an authored element and a list that skipped it would be a list of the scene rather than of the work. `describeAutoMovieSubject`, called with the same pair and an id, resolves any of those and additionally regenerates a placed part or one compact instance on demand. The stable id namespaces are:

- `prototype:<model>` and `prototype-part:<model>/<part>` for reusable geometry;
- `element:<node>` and `element-part:<node>/<part>` for scene placements, where a built-environment element's node id reads `<environment>/<element>`;
- `instance-set:<set>` and `instance:<set>:slot:<six-digit-index>` for compact repetition, with an explicit transform id replacing `slot:<index>` when authored;
- `space:<environment>/<space>` for logical volumes.

The enumeration is not a census. No `element-part:` or `instance:` id ever appears in it, because a placed part and an individual instance are regenerated only when addressed by id. Absence from that list is therefore a fact about the list and not about the scene, which is exactly the mistake `#1902` repeated across round after round of survey while scanning ids for things that were present the whole time. Ask the owner instead: an element's `/members` names its placed parts, and an instance set's `/members` names its instances.

Addressing a slot by its documented namespace is not the same thing as guessing. `describeAutoMovieSubject` parses `instance:<set>:slot:<six-digit-index>` for any index below a generated set's `count`, and an explicitly laid-out set is addressed by its authored transform id instead, so a population larger than one membership sample stays fully reachable either way. What is forbidden is rebuilding an id from a display name or by matching a prefix: the id is the identity, and a prefix match is a guess wearing the shape of an answer.

Do not merge prototype and placement. A prototype answers what geometry and materials exist; an element, placed part, or instance answers where one use of that geometry stands, and `/prototype` on the placement links the two.

## Ask what a room contains

Describe the space; do not search for its contents. A `space:<environment>/<space>` subject carries in `/members` the child spaces under it, every element assigned to it, and every instance set placed in it, each as an id `describeAutoMovieSubject` opens directly. One read answers "what is in this room", from declared containment rather than from name similarity.

Every `/members` is a bounded summary rather than a list. `total` is exact, `items` holds a sample of ids in stable order capped at `AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT`, and `omitted` states how many were left out. Count `total`. Reading the length of `items` as the population is how every rack larger than the sample reports as a rack of exactly the sample size.

## Walk the building, not only its rooms

A room-by-room survey is not a survey of a building. An element's assignment to a logical space is authored, and an exterior wall, a foundation, and a structural frame belong to no room, so a space claims none of them. Measured on the `ExampleBuilding` the scaffold ships as reading material, 9 of its 30 elements are claimed by no space, and every one of the nine is envelope or vertical-transport machinery: four curtain panels, a facade ladder, a lift car, its shell, a counterweight and its block. Every floor slab, partition, door and leaf is claimed. Nothing there is an authoring mistake, and filing a defect asking why the envelope was left out of the rooms is reading the space tree as something it is not.

The space tree is an index over a building. What covers a building is its element hierarchy, and the record says so: `IAutoMovieBuiltEnvironment.buildings` states that ownership is total, every element descending from exactly one unit's roots. So walk the hierarchy, and use the spaces to ask what occupies a room.

The walk needs no key you invented, and it starts wherever the index already names something. `builtEnvironmentUnclaimedElements`, given one environment record, names the elements nothing else lists, meaning a root of the hierarchy that carries no space of its own; the spaces no other space parents name everything under them; and each element's `/members` carries its child elements beside its placed parts, so one step down is always available. Like the rest of this document it runs in a `src/scripts/` module, not in shot source. A transform-only group opens like anything else and reports null for its transform, its content bounds, its materials and its prototype, because it stages nothing itself: what it carries is the structure, which is the reason to open it. Walking that way, `ExampleBuilding` answers 30 of 30 elements from 2 index roots with nothing refused.

## Read bounds honestly

`bounds.content` is measured from compiled primitive or mesh coordinates after the applicable part, rest-bone, and placement transforms. `bounds.declared` is a separate authored extent, and only a space has one; every other kind reports `null` there. Either side may be `null`, so a space can carry a large declared volume beside a smaller content box, or beside no measurable content at all.

`bounds.coordinateSpace` decides whether two boxes may be compared. A prototype and a prototype part are measured in `model` space; elements, placed parts, instances, instance sets, and spaces are measured in `world` space. Differencing one against the other produces a number that means nothing.

A compact instance set's content box measures compiled slot origins, not the geometry standing on them, so a dense set of tall objects still reports a flat box. Address one instance when its prototype extent is the question.

The description does not guess provenance. Join its revision and stable subject id to the separately compiled lineage or evidence ledger when the question asks where a fact came from.

## Compare revisions

`diffAutoMovieSubjects`, called with a before artifact, an after artifact, and an optional tolerance, returns `added`, `removed`, `moved`, `reshaped`, and a bounded `unchanged` summary. Both sides are full `{ revision, compiled }` pairs, so comparing two compiles means holding both sets of bytes; the function reads no history of its own. The default absolute tolerance is `1e-6`, a difference exactly at the tolerance is unchanged, a negative or non-finite tolerance is refused, and equivalent quaternion signs compare as the same rotation.

Movement covers transform, owner, space, and referenced-prototype placement state. Reshaping covers reusable geometry and compact instance-set population laws. One subject may appear in both categories. A prototype change stays one change record carrying aggregate element, instance, and instance-set fan-out, and instance-set prototype reassignment reports a changed-slot count instead of thousands of member records.

`unchanged` is the same bounded summary shape as `/members`, so read its `total` there too. This diff answers whether the compiled model moved and says nothing about whether any picture moved; that second question belongs to this document, and a progress claim worth accepting can show both.

## Ask the host for pictures

A structural description cannot establish appearance. Define the complete viewpoint population from the subject's measured bounds and the design's review condition before drawing, then inspect every planned view. Record the exact source revision, subject id, viewpoint, camera pose, raster, browser and graphics runtime, and observed result in the authored review.

Keep missing, failed, unsupported, and stale views in the denominator. A partial sweep does not become complete by dropping an unavailable view. Repeating source generation or changing its inputs invalidates every dependent observation.

Inspection pictures do not discharge delivery-frame obligations. A sectioned, isolated, or freely framed subject is a different observation from the shot and camera the audience receives. [Capture](capture.md) owns delivery observation conditions; [Production review](review.md) owns the resulting judgment.

## Look inside a building: section planes

A building cannot be judged from outside, because the outside is what hides the inside, and a camera moved into a room shows that room only. Cut the resolved scene instead. `IAutoMovieSectionPlane` declares one half-space to REMOVE, as a coplanar `point` and a `normal` pointing at the removed side.

Where each call runs is the first thing to get right. `classifyAutoMovieSectionPlaneBox` is an `@automovie/engine` calculation over `{ planes, min, max }` that answers `kept`, `cut`, or `crossed` for a subject's bound, so a written finding can name what the cut actually left in view; it belongs in `src/scripts/` with everything else here. `applyAutoMovieSectionPlanes` is an `@automovie/viewer` call over `{ renderer, root, planes }` that makes the cut visible by clipping the materials of an already-built scene, so it needs a live renderer and cannot run in a Node script at all. Reaching for it from `src/scripts/` is the mistake this paragraph exists to prevent.

Derive an inspection cut from the measured subject and camera. It may remove intervening geometry but must not remove the subject being judged. State the cut explicitly in the observation basis.

The scaffold also carries a hand-driven page. `viewer/subject.html?shot=<id>&subject=<kind>:<id>` opens one subject alone, frames it from its own content box rather than from a declared cell, turns a deterministic turntable around it, and takes an inspection-owned section on request; [Debugging](debugging.md#geometry-and-motion-failures) owns its controls. It addresses a subject by viewer key rather than by compiled id, and the two spell the same thing for a space, an element, an instance set, and an instance, while a placed part reads `part:<node>/<part>` there. A prototype is refused outright, with the placement spelling that works, because a prototype stands nowhere in particular. The page writes nothing and produces no receipt, so what it hands back is a look and a name, never evidence.

Do not carry a viewpoint id between the page and inspection. An id is built from the azimuth count and the elevation ring, and the page lays its turntable out against a fixed reference aspect while inspection uses the raster its caller asked for; the aspect sets the fit distance, the distance sets the angle a low ring is lifted to, and a subject standing on the ground therefore plans a different id set under the two. A viewpoint id is a property of the look that was taken, not of the subject, and it is comparable only against a plan built under the same rule. Subject ids do travel between them, which is what a finding should carry.

Derive the plane from geometry you already measured rather than from a guessed offset: a floor level plus `{ x: 0, y: 1, z: 0 }` reads that storey as a plan, and a wall face plus its outward normal opens the elevation behind it. Several planes intersect, so each one added removes more.

These rules are fixed. Geometry lying exactly on the plane is KEPT, so a section taken at a floor's own level still shows that floor. Nothing fills the exposed cut, so walls read as open shells, which is the normal result of a section and not a modelling defect to report. And `crossed` states only that no single plane removed the whole body, which is not a promise that any of it survived, because two planes can between them remove what neither removes alone; writing `crossed` up as "partly visible" is the error the name is chosen to prevent.

A section is an inspection viewpoint and never a delivery camera. `IAutoMovieCamera` carries no clipping plane, a cut frame is not evidence about the image a shot delivers, and shot acceptance is unchanged by any section you take.
