# Inspecting compiled subjects

Use subject inspection after compilation when the question is "what is this?" or "what changed?" and a render is unnecessary. This is an ordinary `@automovie/engine` query over `IAutoMovieCompiledShotSource`; it is not a shot-sandbox global and does not require a new MCP tool.

## Choose the artifact and revision

Load the current project state through the ordinary CLI API, select the compiled shot from `generated.shots`, and pair it with `freshness.compileFingerprint`. Never label an answer with an authoring-session revision or infer freshness from a file timestamp.

`describeAutoMovieSubjects({ revision, compiled })` lists directly stored subjects in stable order. `describeAutoMovieSubject({ revision, compiled }, id)` also resolves a placed part or one compact instance on demand. The stable id namespaces are:

- `prototype:<model>` and `prototype-part:<model>/<part>` for reusable geometry;
- `element:<node>` and `element-part:<node>/<part>` for scene placements;
- `instance-set:<set>` and `instance:<set>:slot:<six-digit-index>` for compact repetition, with an explicit transform id replacing `slot:<index>` when authored;
- `space:<environment>/<space>` for logical volumes.

Do not merge prototype and placement. A prototype answers what geometry and materials exist; an element, placed part, or instance answers where one use stands. The description links them explicitly.

## Read bounds honestly

`bounds.content` is measured from compiled primitive or mesh coordinates after applicable transforms. `bounds.declared` is a separate authored extent when one exists. A space may therefore have a large declared volume and a smaller content box, or either side may be `null`. A compact instance set's content box measures compiled slot origins; inspect an individual instance when its prototype geometry extent matters.

The description does not guess provenance. Join its revision and stable subject id to the separately compiled lineage or evidence ledger when the question asks where a fact came from.

## Compare revisions

`diffAutoMovieSubjects(before, after, tolerance?)` returns `added`, `removed`, `moved`, `reshaped`, and a bounded `unchanged` summary. The default absolute tolerance is `1e-6`; a difference exactly at the tolerance is unchanged. Equivalent quaternion signs compare as the same rotation.

Movement covers transform, owner, space, and referenced-prototype placement state. Reshaping covers reusable geometry and compact instance-set population laws. One subject may be in both categories. Prototype changes remain one change record with aggregate element, instance, and instance-set fan-out. Instance-set prototype reassignment reports a changed-slot count instead of thousands of member records.

## Look inside a building: section planes

A building cannot be judged from outside, because the outside is what hides the inside, and a camera moved into a room shows that room only. Cut the resolved scene instead. `IAutoMovieSectionPlane` declares one half-space to REMOVE as a coplanar `point` and a `normal` pointing at the removed side; `applyAutoMovieSectionPlanes({ renderer, root, planes })` puts it on an already-built scene, and `classifyAutoMovieSectionPlaneBox({ planes, min, max })` answers `kept`, `cut`, or `crossed` for a subject's bound so a written finding names what the cut actually left in view.

Derive the plane from geometry you already measured rather than from a guessed offset: a floor level plus `{ x: 0, y: 1, z: 0 }` reads that storey as a plan; a wall face plus its outward normal opens the elevation behind it. Several planes intersect, so each one removes more.

Two rules are fixed. Geometry lying exactly on the plane is KEPT, so a section taken at a floor's own level still shows that floor. Nothing fills the exposed cut, so walls read as open shells; that is the normal result of a section, not a modelling defect to report.

A section is an inspection viewpoint and never a delivery camera. `IAutoMovieCamera` carries no clipping plane, a cut frame is not evidence about the image a shot delivers, and shot acceptance is unchanged by any section you take.
