# Inspecting compiled subjects

Use subject inspection after compilation to ask what one authored thing is and what it looks like, on its own, without staging a shot around it. Routes answer different halves of that. The numbers come from ordinary `@automovie/engine` queries over an `IAutoMovieSubjectArtifact`, which is one `IAutoMovieCompiledShotSource` paired with the revision you read it at. The pictures come from `inspectProductionSubject`, the project scripts this document gates.

The engine queries run in a project script under `scripts/`, where the whole of `@automovie/engine` is available, and none of them is on the shot-source sandbox surface. That is the point rather than an omission: they read a compiled artifact, and a shot build function is the thing producing one, so a source module asking what it just compiled would be asking about a file that does not exist yet. Every engine name below is therefore written bare, which is this corpus's way of saying a source module may not call it. Section planes reach a call that runs in neither place, and that section says where.

This ground is divided, and no document on it substitutes for another. This one answers what a compiled subject is, how two compiled artifacts differ, and what one subject looks like from an eye the inspection chose. The visual change report answers which already-rendered views moved between two revisions, as digests. A verdict is produced in the evidence citation on the source that claims the unit is realized, and no question answered here produces one.

## Ask the shipped command first

`npm run inspect -- --shot <compiled-shot-id> --subject <kind:id>` opens one compiled subject through the instrument this project already ships and prints what it found. Everything below is how that instrument is built and what its answers mean; reach for the API when you are asking something the command does not, not to repeat what it does.

It does not let you choose the viewpoints, and that is the property that makes an inspection worth anything: an author who could pick the angles could pick flattering ones. `--azimuth-count`, `--elevations-deg`, `--width`, and `--height` exist for a subject the derived sweep genuinely cannot frame, and each has a working default. The observation bytes land under `automovie/inspections`, outside the render root a delivery review reads, because an inspection is not a frame and must never be mistaken for one.

## Choose the artifact and revision

Load and narrow current project state with `loadAutoMovieProjectState` and `requireCurrentAutoMovieProjectState` from `automovie`; [Ownership](../source-authoring/ownership.md) owns that reader and its refusals. Narrowing is not politeness. A stale compile describes a design that no longer exists, and requiring `current` is what makes an inspection a fact about the same bytes a frame would be drawn from.

Pair a compiled shot from `generated.shots` with a revision string. `freshness.compileFingerprint` is the honest label, and it is nullable even on narrowed current state, so decide what to do about `null` instead of asserting it away. Never label an answer with an authoring-session revision, and never infer freshness from a file timestamp.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import { describeAutoMovieSubjects } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const revision = state.freshness.compileFingerprint;
if (revision === null)
  throw new Error("current generated state carries no compile fingerprint");
for (const [shot, compiled] of state.generated.shots)
  for (const subject of describeAutoMovieSubjects({ revision, compiled }))
    console.log(shot, subject.id, subject.kind, subject.members.total);
```

That revision string is your label for the exact bytes you read. A review mints its own label from the compiled shot file it opened, so the two strings are not comparable; join an inspection to a review through the subject id, never through the revision.

## Enumerate, then address

`describeAutoMovieSubjects`, called with `{ revision, compiled }`, lists the directly stored subjects in stable order: prototypes, prototype parts, building elements, instance sets, and logical spaces. Building elements include the transform-only groups the compiler stages no scene node for, because a group is an authored element and a list that skipped it would be a list of the scene rather than of the work. `describeAutoMovieSubject`, called with the same pair and an id, resolves any of those and additionally regenerates a placed part or one compact instance on demand. The stable id namespaces are:

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

The walk needs no key you invented, and it starts wherever the index already names something. `builtEnvironmentUnclaimedElements`, given one environment record, names the elements nothing else lists, meaning a root of the hierarchy that carries no space of its own; the spaces no other space parents name everything under them; and each element's `/members` carries its child elements beside its placed parts, so one step down is always available. Like the rest of this document it runs in a `scripts/` module, not in shot source. A transform-only group opens like anything else and reports null for its transform, its content bounds, its materials and its prototype, because it stages nothing itself: what it carries is the structure, which is the reason to open it. Walking that way, `ExampleBuilding` answers 30 of 30 elements from 2 index roots with nothing refused.

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

The queries above say what a subject is.
A description will not tell you that it looks wrong, and the page that would show you is a page you cannot open.
Subject inspection is that half: name a `shot` and a `subject` id, and the project's own instrument derives a viewpoint plan from the subject's own measured box, has the viewer draw every viewpoint in it, and returns the plan, each resolved pose, the artifact path and digest of each picture, and a coverage record over its own plan.
The sweep publishes `plan.json` before the first picture, an append-only `attempts.json`, and one passed receipt beside each picture.
That receipt names the production and exact target, revision, compile and whole-plan identities, viewpoint and pose, artifact digest, terminal pass, and the actual browser-and-graphics runtime.
A citation can then point at that publication, which is what makes a subject reviewable at all; [Debugging](debugging.md) owns what it does and does not discharge.

Sweep by shot. Staging the compiled shot is what an observation costs, and the host draws every subject standing in one shot from one staged page, so twenty subjects of a shot cost one scene build and twenty draws rather than twenty of each. Nothing about the observations changes: each is resolved, framed, and sectioned from its own subject, and the section rides the eye it was taken from. Ordering a sweep by shot is the difference between minutes and an afternoon on a production with hundreds of authored things.

The subject id is the same stable id the queries above hand you, and a name copied out of the viewer is taken as it stands: a `part:<node>/<part>` key resolves against the compiled `element-part:` and `prototype-part:` spellings, and a trailing `@revision` is read as the state it was seen at rather than as a different subject. Paste the name you were given.

Framing comes from the subject's own `bounds`, so a mullion a few centimetres across and an elevation tens of metres wide are fitted by one rule and neither needs a distance you invented. Viewpoint identities are derived from the angles, so two callers naming the same subject with the same rule receive the same viewpoint ids, in the same order, resolved to the same camera state. That is what lets a finding travel as `element:<node>` and a viewpoint id instead of as a screenshot: the other side opens the same thing under the same condition.

The turntable is inspection's to decide rather than your guesswork. `azimuthCount`, `elevationsDeg`, `distanceFactor`, `width` and `height` are optional overrides that all have working defaults, and each is range-checked, so an azimuth count, elevation ring, or distance factor outside what the plan admits is refused as invalid input rather than clamped silently. An elevation that would drive the eye underground is the exception, and it is raised: a turntable angle is measured from the subject's centre, a room standing on the ground has its centre well above it, and a low ring therefore digs. The eye is not taken below the floor, and the floor is world zero unless the subject's own box reaches lower, in which case the box's own bottom is the limit. Elevations that land on one angle collapse into one viewpoint, so the returned `plan` can be shorter than the list you sent. Read the plan you got back, never the one you asked for.

An observation is not a frame, and that separation is structural rather than a rule anyone has to remember.
Artifacts are written to `automovie/inspections/<production>/<shot>/<subject>/<plan identity>/attempt-<n>/<viewpoint>.png`, outside the render root a delivery review reads when it collects frame evidence, so an inspection picture cannot enter that population however a caller describes it.
The returned object carries `deliveryEvidence` typed as the literal `false`, so a consumer requiring delivery evidence does not compile against it; a case proves that with `@ts-expect-error` rather than with prose.
The scaffold leaves that directory untracked, so a sweep travels in no commit; it is working state of one checkout, and a review reads it from the working tree where it was drawn.
Deleting or replacing a picture withdraws it, because a receipt answers for its artifact only while that artifact still hashes to the digest recorded in it.

Currentness is measured, not inferred from package versions or a successful page load.
The inspection host retains the capture launch closure, asserts that closure before and after page setup and every draw, inspects the actual WebGL identity, and gives both to the production service.
If the closure moves, graphics cannot be identified, the persisted JSON is malformed, duplicate-keyed, or not strict UTF-8, or any plan, pose, locator, digest, runtime, or terminal-status join disagrees, recapture the whole subject under a stable host; do not cite the surviving prefix as current coverage.
Previous failed, unsupported, not-run, and runtime-unidentified attempts remain in the journal and do not erase a separately reopened current pass.

That is also why inspection is not another `npm run preview` target.
A delivery capture receipt combines runtime identity with a render bundle, target fingerprint, and review target; those delivery-lineage fields would make an inspection frame consumable as a shot review.
A subject observation carries the same truthful runtime freshness but none of those delivery fields, which is the point of the separate adapter.

`inspected: true` means every planned viewpoint produced a verified picture; the first one that did not returns a refusal instead, so a partial sweep is never reported as an inspection. Read the refusals literally.

- `capture-host-unavailable` means this host was configured without an inspection instrument, and the message names the adapter to provide. A tool that exists and pixels that come out are different facts, and this refusal is the boundary between them: AutoMovie will not fabricate an observation it did not draw.
- `compile-missing`, `generated-stale` and `compile-current-invalid` mean the compiled artifact is absent, behind current source, or failing the read-only gate. Run the scaffold compile command before opening a subject.
- `capture-target-missing` means the id is not in that artifact. Enumerate, as above, rather than retrying a spelling.
- `preview-input-invalid` means your own override was outside what the plan admits, or your raster was not a positive integer size within the production frame. Read the message, correct the input, and do not retry the same numbers.
- `review-subject-viewpoint-unsupported` means the subject carries no measured extent to frame, which is the honest answer for a formation. Report that range as unsupported, not as observed. Note that subject review reports this same code as a standing warning about something else entirely; [Debugging](debugging.md) says what it means there.
- `capture-png-blank` means a viewpoint decoded with no visible pixel variance. An empty picture is not an observation of anything.
- `capture-input-changed` means the compile moved mid-sweep, so the pictures are of two different models. Discard them, compile, and inspect again.
- `capture-failed`, `capture-png-invalid` and `capture-size-mismatch` are the instrument answering badly: it threw, returned bytes that are not a decodable PNG, or drew a raster other than the one asked for. Repair the host rather than the subject.

A prototype and a prototype part are measured in model space and stand nowhere in a shot, so a world eye aimed at one would photograph whatever occupies the origin. The scaffold's host refuses those through `review-subject-viewpoint-unsupported` and names the placement to open instead, which is the same prototype-and-placement rule this document states above, enforced at the point where ignoring it would return a confident picture of the wrong place. Read that code as a refusal about the subject rather than about the instrument: the staged page stays open, so the rest of the sweep does not pay for a rebuild, and the range is reported unsupported rather than as work you still owe.

## Look inside a building: section planes

A building cannot be judged from outside, because the outside is what hides the inside, and a camera moved into a room shows that room only. Cut the resolved scene instead. `IAutoMovieSectionPlane` declares one half-space to REMOVE, as a coplanar `point` and a `normal` pointing at the removed side.

Where each call runs is the first thing to get right. `classifyAutoMovieSectionPlaneBox` is an `@automovie/engine` calculation over `{ planes, min, max }` that answers `kept`, `cut`, or `crossed` for a subject's bound, so a written finding can name what the cut actually left in view; it belongs in `scripts/` with everything else here. `applyAutoMovieSectionPlanes` is an `@automovie/viewer` call over `{ renderer, root, planes }` that makes the cut visible by clipping the materials of an already-built scene, so it needs a live renderer and cannot run in a Node script at all. Reaching for it from `scripts/` is the mistake this paragraph exists to prevent.

`inspectProductionSubject` takes this cut for you. Nobody can press a key during a headless sweep, so its host cuts unconditionally, at the subject's own bounding sphere on the side the eye stands. That plane sits at or outside every corner of the subject's box, so it can only remove what stands between the eye and the subject and never the subject itself; an exterior subject pays nothing for it.

The scaffold also carries a hand-driven page. `viewer/subject.html?shot=<id>&subject=<kind>:<id>` opens one subject alone, frames it from its own content box rather than from a declared cell, turns a deterministic turntable around it, and takes an inspection-owned section on request; [Debugging](debugging.md#geometry-and-motion-failures) owns its controls. It addresses a subject by viewer key rather than by compiled id, and the two spell the same thing for a space, an element, an instance set, and an instance, while a placed part reads `part:<node>/<part>` there. A prototype is refused outright, with the placement spelling that works, because a prototype stands nowhere in particular. The page writes nothing and produces no receipt, so what it hands back is a look and a name, never evidence.

Do not carry a viewpoint id between the page and inspection. An id is built from the azimuth count and the elevation ring, and the page lays its turntable out against a fixed reference aspect while inspection uses the raster its caller asked for; the aspect sets the fit distance, the distance sets the angle a low ring is lifted to, and a subject standing on the ground therefore plans a different id set under the two. A viewpoint id is a property of the look that was taken, not of the subject, and it is comparable only against a plan built under the same rule. Subject ids do travel between them, which is what a finding should carry.

Derive the plane from geometry you already measured rather than from a guessed offset: a floor level plus `{ x: 0, y: 1, z: 0 }` reads that storey as a plan, and a wall face plus its outward normal opens the elevation behind it. Several planes intersect, so each one added removes more.

These rules are fixed. Geometry lying exactly on the plane is KEPT, so a section taken at a floor's own level still shows that floor. Nothing fills the exposed cut, so walls read as open shells, which is the normal result of a section and not a modelling defect to report. And `crossed` states only that no single plane removed the whole body, which is not a promise that any of it survived, because two planes can between them remove what neither removes alone; writing `crossed` up as "partly visible" is the error the name is chosen to prevent.

A section is an inspection viewpoint and never a delivery camera. `IAutoMovieCamera` carries no clipping plane, a cut frame is not evidence about the image a shot delivers, and shot acceptance is unchanged by any section you take.
