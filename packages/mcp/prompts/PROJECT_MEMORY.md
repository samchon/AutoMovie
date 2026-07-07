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

## Ordering

Resident commits are gated by the prerequisite ladder: script → scene → shots → (beat ends, notes, film). An out-of-order commit throws an actionable error naming the current status, the missing rungs, and the ordered next actions. `nextSteps` returns the same computation as data — ask it before guessing. Explicit-slate calls are not gated (order lives where state lives).

## Assets

`registerAsset` records project-relative asset paths (a GLB, a texture, a rendered frame) in the manifest. Paths must stay inside the project (no absolute paths, no `..`), and registration **never silently overwrites** — an already-registered path or an existing file is refused. Byte-less registration tracks files a host adapter writes (renders, exports); the manifest stays the single index of what the project owns.
