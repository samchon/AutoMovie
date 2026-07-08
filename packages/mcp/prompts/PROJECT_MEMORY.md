# Project Memory

The project folder itself is the durable state — not a hidden mirror. `openProject` activates (or creates) a directory whose tree is human-readable JSON slices plus registered assets: `automovie.json` (manifest with the asset index), `script.json`, `scene.json`, `notes.json`, `film.json`, `shots/<beat>.json`, `beatEnds/<beat>.json`, and reserved `props/`, `models/`, `assets/`, `renders/` directories. A fresh directory is a valid empty project. You can read the files, diff them, and version them — they ARE the state.

## Resident vs Explicit

Every commit and query tool works in two modes:

- **Resident** (omit `slate`): the tool reads and transforms the project's own state and, on success, writes through to the files. This is the mode for real work — no re-sending hundreds of beats per call.
- **Explicit** (pass `slate`): a pure stateless transform. The project is never touched. Use it for what-if checks or when driving state you manage yourself.

## Write-Through Rules

- A successful resident commit persists exactly the slices it changed. A failed commit writes nothing.
- **A cleared slice's file is removed.** Committing a new script clears scene/shots/beatEnds/notes/film — and in the project tree those files disappear. The invalidation cascade is visible on disk; a missing file IS the stale marker.
- Writes are atomic (temp file + rename); a crash never leaves a half-written slice.
- **Beat commits upsert.** Re-committing a beat replaces exactly that beat's `shots/<beat>.json` (or `beatEnds/<beat>.json`); sibling beats' files stay byte-identical.

## Surgical Erase and Set

- `eraseShot` removes ONE beat's shot file together with that beat's end-state and notes, and nulls the film. `eraseNotes` removes only the beat's notes and nulls the film. Both demand a `reason` (evidence, not ceremony) and refuse a beat with nothing to erase. Clearing everything a script owns is `commitScript`'s job — a targeted erase of the root would be a reset in disguise.
- `setActorPerformance` splices one actor's performance inside one committed shot (replacement-only — a new performer belongs to `perform` + `commitShot`), removes that beat's end-state, and nulls the film; other beats' files are untouched.
- `setPlacement` moves one staged node and mirrors `commitScene`'s full downstream clear (shots, beat ends, notes, film): shots kept against moved world coordinates would be silently stale geometry. The gain over restaging is precision — one node moves, the rest of the staging is untouched — not a shortcut around re-performing.

## Ordering

Resident commits are gated by the prerequisite ladder: script → scene → shots → (beat ends, notes, film). An out-of-order commit throws an actionable error naming the current status, the missing rungs, and the ordered next actions. `nextSteps` returns the same computation as data — ask it before guessing. Explicit-slate calls are not gated (order lives where state lives).

## Assets

`registerAsset` records project-relative asset paths (a GLB, a texture, a rendered frame) in the manifest. Paths must stay inside the project (no absolute paths, no `..`), and registration **never silently overwrites** — an already-registered path or an existing file is refused. Byte-less registration tracks files a host adapter writes (renders, exports); the manifest stays the single index of what the project owns.
