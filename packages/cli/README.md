# @automovie/cli

Scaffold an [automovie](https://github.com/samchon/automovie) project.

```bash
npx create-automovie my-film
npx automovie migrate legacy-film --dry-run
npx automovie migrate legacy-film
```

Lays down a starter with both ways to drive the engine:

- ordinary TypeScript source for treatment, shot, motion, effects, and tests;
- a Claude-compatible **MCP** server config (`.mcp.json`) for actual-frame
  evidence and review gates; and
- a local viewer and Playwright capture path that render compiler-owned output.

The coding agent owns `src`, `docs`, `test`, and `public`. AutoMovie owns bounded
design documents, the `generated` directory, compile fingerprints, and the
review ledger. The starter intentionally keeps long-form authoring in files
instead of asking the model to serialize dense motion graphs through tool
calls.

Treatment and screenplay prose live under `docs/<production>/`. Their machine
index lives at `.automovie/design/screenplay/index.json` before the first open
and migrates into the selected production namespace. `npm run lint` checks exact
beat coverage, SCN headings and bodies, the permanent soft-lock ledger,
catalog/continuity references, and realized scene coverage without replacing
the prose with JSON.

## Starter workflow

```bash
npm install
npm run capture:install
npm run capture:doctor
npm run build
npm test
npm run lint:source
npm run preview -- --shot opening --time 2 --pass beauty
npm run review:status
# Complete the current evidence-bound MCP review, then:
npm run lint
npm run verify
npm run render -- all --tier proxy
npm run viewer
```

The viewer listens at `http://127.0.0.1:5173`. The initial review-bound
commands may stop at their named gate until the starter evidence is reviewed.

`npm run lint:source` type-checks source and runs the registered lint
contributors without changing project state. `npm run compile` is the only
command allowed to materialize `generated` output. `npm run lint` runs source
lint first and is stricter: it reruns production compilation without writing and
fails until every current design, source, shot, and film review is complete.
`preview` captures the project-owned viewer and records a frame tied to
target-local generated/viewer inputs and the renderer identity; review cannot
complete against an arbitrary or stale screenshot.

`npm run verify` is the read-only final gate. It reopens compiler-owned bytes,
review state, render receipts, and delivery media and refuses damaged output or
forged ownership claims. Claude Code receives a project hook that blocks direct,
Bash, MCP, and symlink-aliased writes to generated, render, capture, and
production state while leaving authored design and review records writable.

The default capture runtime is the Chromium build pinned to the starter's
Playwright package. `capture:install` downloads it explicitly into
Playwright's project-local browser path and writes an ignored receipt containing
the package version, browser revision, executable path, and executable digest.
Each package/browser generation owns one immutable no-overwrite receipt slot.
The current metadata key is read through one ancestry-bound descriptor snapshot;
when that exact slot is absent, the old fixed receipt remains the untouched
migration fallback. Receipt descriptors enforce their byte ceiling before every
hash, and any failed final-slot creation remains visible for explicit manual
adjudication instead of risking pathname cleanup of a successor.
`capture:doctor` launches that exact executable, requires WebGL, captures a
canvas, and decodes the PNG. Proxy and offline mirror settings use Playwright's
standard `HTTPS_PROXY`, `PLAYWRIGHT_DOWNLOAD_HOST`, and
`PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` environment variables. The default
`PLAYWRIGHT_BROWSERS_PATH=0` keeps the binary package-local; set that variable
to an explicit path to use a configured shared cache.

System Chrome or Edge remains an explicit compatibility choice in
`automovie.config.ts`:

```ts
capture: {
  browser: { source: "system-channel", channel: "chrome" },
}
```

A configured executable must likewise declare its product and path; its exact
binary digest, rather than a guessed machine identity, enters render evidence.

Each render bundle stores canonical structured identity for Playwright, browser
revision/source, executable digest when available, platform, headless/raster
mode, requested backend, and actual WebGL vendor/renderer. Existing v2 bundle
manifests remain on disk but require recapture before they can serve as current
review evidence; they remain target-scoped history warnings and do not block a
current valid v3 bundle.

Chunk render `status`, `verify`, and `finalize` re-run the capture, actual
graphics, declared render-source, and package-owned encoder identity preflight.
They can launch Chromium and mark every stored chunk stale when that structured
runtime identity changes.

Render plans use an append-only predecessor chain with one immutable no-overwrite successor slot per generation. A stale planner cannot replace a winner, legacy `plan.json` bytes remain an immutable root, and each render session keeps its captured plan for scheduling, receipt verification, status, and finalization instead of reopening a later pathname generation.

Descriptor-bound render final slots are never automatically removed after creation begins. A write, readback, target, parent, or root validation failure leaves visible evidence for the consumer's strict gate and explicit GC or manual adjudication instead of risking deletion of a relinked successor.

Dialogue synthesis caches each content key as one immutable directory, publishes both file slots through descriptor-bound `O_EXCL` with `audio.f32` before `receipt.json`, and accepts a cache hit only from one captured and revalidated two-file generation. Legacy sibling `.f32` and `.json` entries are ignored and regenerated without replacement.

Proxy finalization publishes content-addressed materialized directories without replacing existing paths: each payload reserves and writes its final pathname directly through descriptor-bound `O_EXCL`, the root receipt appears last, and every manifest path remains an ordinary render-root-relative file that external consumers can open directly.

Chunk workers publish complete UUID claims before they become visible inside a
slot-specific lock namespace. They yield to every other live claim and remove
only their own exact path. A killed worker leaves either a recoverable claim or
a non-authoritative candidate that the next run isolates under private preserved
evidence and exposes through an immutable public quarantine marker. Receipt reuse
rejects linked state ancestors and files, and final encoding consumes the exact
PNG bytes authenticated by that physical-path read.

Render GC parses each valid quarantine marker relative to its proxy or final ownership tier through its captured descriptor, binds the referenced private evidence by kind, identity, and content fingerprint, reports their combined bytes, and removes the evidence before its exact marker and pre-captured empty private container. A container pathname successor is preserved. Damaged markers remain independently reclaimable while ambiguous physical duplicate evidence references across tiers remain preserved for manual adjudication.

## Usage

```
npx create-automovie <directory> [--force]
npx automovie start <directory> [--force]
npx automovie verify
npx automovie migrate <directory> [--dry-run | --rollback]
```

`start` refuses a non-empty directory unless `--force`. The scaffolded project's
`@automovie/*` dependency versions are baked in at build time from this repo's
own catalog (`build/sync-versions.mjs`), so a starter never drifts from the
engine it targets.

`migrate --dry-run` validates legacy v1 storage from a temporary copy and prints
the immutable byte inventory, production and shot drafts, source TODOs, and
warnings without touching the project. Plain `migrate` atomically adds only
tracked `.automovie` provenance; it never rewrites legacy files or guesses the
missing creative TypeScript. `--rollback` removes that state only while no
production work has changed it. The import plan fingerprints the pre-import
`src`, `generated`, and `renders` baselines, and rollback restores the complete
applied state if removing any newly created empty directory fails. Baselines
include empty subdirectory topology as well as file bytes, and the project root
stays locked until rollback either completes or restores `.automovie`.

## API

The renderer and writer are exported for programmatic use: the render step
returns an in-memory file map, and writing is a separate call, so the same
output can be asserted in a test or written by another consumer:

```ts
import { renderScaffold, writeFiles } from "@automovie/cli";

const files = renderScaffold({ name: "my-film" }); // { "package.json": "...", ... }
writeFiles("./my-film", files);
```

Ordinary Node scripts can also load the current tracked design and the last
compiler-owned snapshot without starting an MCP server or client:

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  Vector3,
  formationSlot,
  reachPose,
  sampleFormationMotion,
  transformFormationPoint,
} from "@automovie/engine";

const loaded = loadAutoMovieProjectState({ root: process.cwd() });
const state = requireCurrentAutoMovieProjectState(loaded);
const shot = state.generated.shots.get("opening")!;
const formation = state.generated.design.formations.get("army")!;
const runtime = shot.formations.find((item) => item.id === formation.id)!;
const base = formationSlot(formation, 31).position;
const atTwoSeconds = transformFormationPoint(
  base,
  runtime.anchor,
  sampleFormationMotion(shot.formationMotions, formation.id, 2),
  runtime.facingDeg,
);
const landmark = state.generated.design.world.landmarks[0]!.position;
const distance = Vector3.length(Vector3.subtract(atTwoSeconds, landmark));
const actor = shot.scene.nodes.find((item) => item.id === "sentinel")!;
const model = shot.models.find((item) => item.id === actor.model)!;
const reach =
  model.skeleton === null
    ? null
    : reachPose(model.skeleton, "right", { x: 0.5, y: 1.2, z: 0 });
```

`freshness` always carries the loaded compile fingerprint, the fingerprint
recomputed from current source, the current project revision, diagnostics, and
reader integrity problems. Use `requireCurrentAutoMovieProjectState` before
measuring; it refuses both missing and stale output rather than letting a script
quietly answer from an old compile.

This API is an external I/O boundary. Never import or call it inside a shot or
film `build` function: the compiler executes those functions in a deterministic
no-I/O sandbox. Use it only from measurement scripts, tests, and offline
diagnostics, then pass the loaded values to pure `@automovie/engine` functions.
