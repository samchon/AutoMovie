# Inspecting compiled subjects

Use subject inspection after compilation when the question is "what is this?" or "what changed?" and a render is unnecessary. These are ordinary `@automovie/engine` queries over an `IAutoMovieSubjectArtifact`, which is one `IAutoMovieCompiledShotSource` paired with the revision you read it at; none is a shot-sandbox global and none needs an MCP tool.

They run in a project script under `scripts/`, where the whole of `@automovie/engine` is available, and none of them is on the shot-source sandbox surface. That is the point rather than an omission: they read a compiled artifact, and a shot build function is the thing producing one, so a source module asking what it just compiled would be asking about a file that does not exist yet. Every engine name below is therefore written bare, which is this corpus's way of saying a source module may not call it. Section planes are the one topic here with a half that runs elsewhere, and that section says so.

Three guides divide this ground and none of them substitutes for another. This one answers what a compiled subject is and how two compiled artifacts differ, as numbers read from the artifact. `VISUAL_CHANGE_REPORT` answers which already-rendered views moved between two revisions, as digests. `REVIEW_SUBJECT` is the only one of the three that produces a verdict.

## Choose the artifact and revision

Load and narrow current project state with `loadAutoMovieProjectState` and `requireCurrentAutoMovieProjectState` from `@automovie/cli`; `GEOMETRY` owns that reader and its refusals. Narrowing is not politeness. A stale compile describes a design that no longer exists, and requiring `current` is what makes an inspection a fact about the same bytes a frame would be drawn from.

Pair a compiled shot from `generated.shots` with a revision string. `freshness.compileFingerprint` is the honest label, and it is nullable even on narrowed current state, so decide what to do about `null` instead of asserting it away. Never label an answer with an authoring-session revision, and never infer freshness from a file timestamp.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
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

That revision string is your label for the exact bytes you read. `prepareReview` mints its own label from the compiled shot file it opened, so the two strings are not comparable; join an inspection to a review through the subject id, never through the revision.

## Enumerate, then address

`describeAutoMovieSubjects`, called with `{ revision, compiled }`, lists the directly stored subjects in stable order: prototypes, prototype parts, scene elements, instance sets, and logical spaces. `describeAutoMovieSubject`, called with the same pair and an id, resolves any of those and additionally regenerates a placed part or one compact instance on demand. The stable id namespaces are:

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

## Read bounds honestly

`bounds.content` is measured from compiled primitive or mesh coordinates after the applicable part, rest-bone, and placement transforms. `bounds.declared` is a separate authored extent, and only a space has one; every other kind reports `null` there. Either side may be `null`, so a space can carry a large declared volume beside a smaller content box, or beside no measurable content at all.

`bounds.coordinateSpace` decides whether two boxes may be compared. A prototype and a prototype part are measured in `model` space; elements, placed parts, instances, instance sets, and spaces are measured in `world` space. Differencing one against the other produces a number that means nothing.

A compact instance set's content box measures compiled slot origins, not the geometry standing on them, so a dense set of tall objects still reports a flat box. Address one instance when its prototype extent is the question.

The description does not guess provenance. Join its revision and stable subject id to the separately compiled lineage or evidence ledger when the question asks where a fact came from.

## Compare revisions

`diffAutoMovieSubjects`, called with a before artifact, an after artifact, and an optional tolerance, returns `added`, `removed`, `moved`, `reshaped`, and a bounded `unchanged` summary. Both sides are full `{ revision, compiled }` pairs, so comparing two compiles means holding both sets of bytes; the function reads no history of its own. The default absolute tolerance is `1e-6`, a difference exactly at the tolerance is unchanged, a negative or non-finite tolerance is refused, and equivalent quaternion signs compare as the same rotation.

Movement covers transform, owner, space, and referenced-prototype placement state. Reshaping covers reusable geometry and compact instance-set population laws. One subject may appear in both categories. A prototype change stays one change record carrying aggregate element, instance, and instance-set fan-out, and instance-set prototype reassignment reports a changed-slot count instead of thousands of member records.

`unchanged` is the same bounded summary shape as `/members`, so read its `total` there too. This diff answers whether the compiled model moved and says nothing about whether any picture moved; that second question belongs to `VISUAL_CHANGE_REPORT`, and a progress claim worth accepting can show both.

## Look inside a building: section planes

A building cannot be judged from outside, because the outside is what hides the inside, and a camera moved into a room shows that room only. Cut the resolved scene instead. `IAutoMovieSectionPlane` declares one half-space to REMOVE, as a coplanar `point` and a `normal` pointing at the removed side.

Its two halves run in different places, and that is the first thing to get right. `classifyAutoMovieSectionPlaneBox` is an `@automovie/engine` calculation over `{ planes, min, max }` that answers `kept`, `cut`, or `crossed` for a subject's bound, so a written finding can name what the cut actually left in view; it belongs in `scripts/` with everything else in this guide. `applyAutoMovieSectionPlanes` is an `@automovie/viewer` call over `{ renderer, root, planes }` that makes the cut visible by clipping the materials of an already-built scene, so it needs a live renderer and cannot run in a Node script at all. Reaching for it from `scripts/` is the mistake this paragraph exists to prevent.

The starter carries the page that does run it. `viewer/subject.html?shot=<id>&subject=<kind>:<id>` opens one subject alone, frames it from its own content box rather than from a declared cell, turns a deterministic turntable around it, and takes an inspection-owned section on request; the scaffold README documents its keys. It addresses a subject by viewer key rather than by compiled id, and the two spell the same thing for a space, an element, an instance set, and an instance, while a placed part reads `part:<node>/<part>` there. A prototype is refused outright, with the placement spelling that works, because a prototype stands nowhere in particular. The page writes nothing and produces no receipt, so what it hands back is a look and a name, never evidence.

Derive the plane from geometry you already measured rather than from a guessed offset: a floor level plus `{ x: 0, y: 1, z: 0 }` reads that storey as a plan, and a wall face plus its outward normal opens the elevation behind it. Several planes intersect, so each one added removes more.

These rules are fixed. Geometry lying exactly on the plane is KEPT, so a section taken at a floor's own level still shows that floor. Nothing fills the exposed cut, so walls read as open shells, which is the normal result of a section and not a modelling defect to report. And `crossed` states only that no single plane removed the whole body, which is not a promise that any of it survived, because two planes can between them remove what neither removes alone; writing `crossed` up as "partly visible" is the error the name is chosen to prevent.

A section is an inspection viewpoint and never a delivery camera. `IAutoMovieCamera` carries no clipping plane, a cut frame is not evidence about the image a shot delivers, and shot acceptance is unchanged by any section you take.
