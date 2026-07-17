# Project Memory

The project folder itself is the durable state — not a hidden mirror. `openProject` activates (or creates) a directory whose tree is human-readable JSON slices plus registered assets: `automovie.json` (manifest with the asset index), `script.json`, `scene.json`, `notes.json`, `film.json`, `shots/<beat>.json`, `beatEnds/<beat>.json`, `props/<node>.json` (stored forged prop specs), `actors/<node>.json` (stored actor contexts), and reserved `models/`, `assets/`, `renders/` directories. A fresh directory is a valid empty project. You can read the files, diff them, and version them — they ARE the state.

## Resident vs Explicit

Every commit and query tool works in two modes:

- **Resident** (omit `slate`): the tool reads and transforms the project's own state and, on success, writes through to the files. This is the mode for real work — no re-sending hundreds of beats per call.
- **Explicit** (pass `slate`): a pure stateless transform. The project is never touched. Use it for what-if checks or when driving state you manage yourself.

`getSlate` reads the whole resident slate back as one document — script, scene, shots, beat ends, notes, and film together — so you can inspect the current committed state without re-deriving it from the individual files or re-sending it. It is the read companion to the commit ladder: ask it (or `nextSteps` for just the status and next actions) before guessing what the project already holds.

## Write-Through Rules

- A successful resident commit persists exactly the slices it changed. A failed commit writes nothing.
- **A cleared slice's file is removed.** Committing a new script clears scene/shots/beatEnds/notes/film — and in the project tree those files disappear. The invalidation cascade is visible on disk; a missing file IS the stale marker.
- Writes are atomic (temp file + rename); a crash never leaves a half-written slice.
- **Beat commits upsert.** Re-committing a beat replaces exactly that beat's `shots/<beat>.json` (or `beatEnds/<beat>.json`); sibling beats' files stay byte-identical.
- **Downstream cascades beyond the script/scene clears:** `commitShot` also removes that beat's end-state and review notes (they reviewed the replaced shot) and nulls the committed film; `commitBeatEnd` and `commitNotes` null the film. If you had committed `film.json`, re-commit it after any of these — a beat's shot, continuity, or review changed under the cut.
- **Compiled motions are not a slice.** A shot stores motion id references, never the clips; the clips are re-`perform`-derived, so the project keeps the AST and re-derives motion on demand. A resident `commitShot` referencing motions must therefore pass the `motions` registry to validate those references (a dangling id is refused, not stored).
- **Geometry rig payloads are session memory.** Resident `commitScene` remembers the supplied model skeletons, and resident `commitShot` remembers the supplied motion registry, so `getReach` / `getResolvedPose` can omit explicit context in the same application session. These payloads are not files: reopening a project still has the scene and shot ids, but not cast skeleton payloads or compiled clips. Re-run the commits in that session or pass explicit context for rig/motion queries; `measureDistance` only needs the stored scene.

## Surgical Erase and Set

- `eraseShot` removes ONE beat's shot file together with that beat's end-state and notes, and nulls the film. `eraseNotes` removes only the beat's notes and nulls the film. Both demand a `reason` (evidence, not ceremony) and refuse a beat with nothing to erase. Clearing everything a script owns is `commitScript`'s job — a targeted erase of the root would be a reset in disguise.
- `setActorPerformance` splices one actor's performance inside one committed shot (replacement-only — a new performer belongs to `perform` + `commitShot`), removes that beat's end-state and review notes, and nulls the film; other beats' files are untouched.
- `setPlacement` moves one staged node and mirrors `commitScene`'s full downstream clear (shots, beat ends, notes, film): shots kept against moved world coordinates would be silently stale geometry. The gain over restaging is precision — one node moves, the rest of the staging is untouched — not a shortcut around re-performing. Its `transform.rotation` is authored as semantic Euler degrees (or omitted for identity); the engine lowers the angles to a quaternion so you never emit one.

## Ordering

Resident commits are gated by the prerequisite ladder: script → scene → shots → (beat ends, notes, film). An out-of-order commit throws an actionable error naming the current status, the missing rungs, and the ordered next actions. `nextSteps` returns the same computation as data — ask it before guessing. Explicit-slate calls are not gated (order lives where state lives).

## Props

A resident `forgeProp` success writes the accepted spec through as `props/<node>.json` and answers `stored: true` — forge a prop once, and every later session reads it from the project instead of you re-sending the spec. Re-forging a prop replaces exactly its own file; sibling props stay byte-identical. Failed forges and no-project calls store nothing. Re-forging a prop the committed scene still places is refused (`stored: false`), symmetric with `eraseProp`: replacing the spec would leave committed shots resolving against stale articulation, so re-commit the scene without the placement first (or accept re-perform). A first forge of a not-yet-stored node always stores — it creates the spec shots need rather than replacing one. `eraseProp` removes ONE stored spec (with a `reason`, like every erase); a prop the committed scene still places is refused, not cascaded — re-commit the scene without the placement first, because clearing the scene from a spec erase would be a reset in disguise. The project summary and `nextSteps` status list the stored prop nodes under `props`.

## Actors

A successful **resident** `perform` with an explicit `actors` registry writes each context's beat-invariant half (skeleton, gaits, speed, eye height, rest pose, optional rig and rest frames) through as `actors/<node>.json` — supply an actor's rig once, and every later resident `perform` may omit `actors` entirely: the stored contexts are read back and their per-beat openings (`position`/`facingDeg`) are seeded from the previous beat's committed end-state. Re-performing with explicit actors upserts exactly the named contexts; sibling actors stay byte-identical, and a node that case-collides with a stored sibling (or another node in the same registry) is refused before anything runs — the upsert rename would silently destroy the sibling's file. Failed performs and no-project calls store nothing. A tampered stored context is blamed at `$slate.actors`, where it lives. `eraseActor` removes ONE stored context (with a `reason`, like every erase); an actor the committed scene still stages is refused, not cascaded — later resident performs would lose the context their beats depend on. The project summary and `nextSteps` status list the stored actor nodes under `actors`.

## Assets

`registerAsset` tracks ONE project-relative asset path per call (a GLB, a texture, a rendered frame) in the manifest and returns the normalized path with the full asset index. Paths must stay inside the project (no absolute paths, no `..`), and registration **never silently overwrites** — a duplicate path is refused as a violation and the index is unchanged. The tool registers paths only: byte-writing stays the host adapter's job (binaries never flow through the server), so register the file the adapter wrote or is about to write. The manifest stays the single index of what the project owns.
