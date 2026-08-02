# {{name}}

This is a coding-agent-first AutoMovie production repository. Write treatment,
screenplay, shot builders, motion helpers, effects, audio integration, and tests
as ordinary files. AutoMovie owns bounded design, deterministic generated
output, geometry facts, actual-frame evidence, and review freshness.

Treatment and screenplay prose are under `docs/{{name}}`. Keep their exact
beat and `SCN-*` identities aligned with
`.automovie/design/screenplay/index.json`; once shots exist, retain locked
numbers, use `OMITTED` tombstones for deletions, and alpha ids for insertions.
`npm run lint` checks those joins and requires compiled realization plus completed
shot/film acceptance evidence for the same realized shot before an active scene
leaves the coverage ledger. Catalog entries bind explicitly to shared model,
formation, and world-landmark ids; continuity claims name the exact passing
outcome or acceptance scenario that proves them.

`src/examples/lineBattle.ts` demonstrates the behavior-library boundary:
typed weapon/profile facts and seeded engine outcomes feed agent-owned drill
code, while 100 civilians and 1,000 trees use compact non-formation instance
sets instead of scene-node expansion.

Every distributable file matched by the asset lint configuration belongs in
`.automovie/assets.json`. Record its source URL, license, original/current
SHA-256, processing chain, and reasoned use before referencing it. External
glTF, GLB, and VRM entries also require explicit ingest, LOD, collision, and
measurement-proxy decisions. Changed or unregistered bytes fail lint and
compilation; ingestion itself remains a pure fixed-byte conversion.

## First run

Frame capture defaults to the Chromium build pinned to this project's Playwright version. Installation is explicit rather than a hidden dependency postinstall. The installer revalidates Playwright/core metadata as one composite snapshot and runs the exact captured CLI bytes through an inherited descriptor. The ignored receipt binds the package version, browser revision, executable path, and executable digest, and each canonical package/browser generation publishes one immutable descriptor-bound `O_EXCL` slot after final provenance validation. The reader selects only the exact current metadata key and binds its ancestry, descriptor, pathname, and bytes through the completed read; if that slot is absent, the legacy fixed receipt remains the untouched migration fallback. Receipt descriptors enforce the 64 KiB ceiling before initial hashing and every rehash. Any failed final-slot creation remains visible and fails closed with explicit manual-adjudication guidance instead of risking pathname cleanup of a successor. The doctor launches that exact binary, requires WebGL, captures a canvas, and decodes the PNG. Package metadata and the receipt are descriptor-bound snapshots, and the verified executable stays open and identity-checked through browser launch.

```bash
npm install
npm run capture:install
npm run capture:doctor
npm run build
npm test
npm run lint:source
npm run lint
npm run verify
npm run preview -- --shot opening --time 2 --pass beauty
npm run review:status
npm run render -- all --tier proxy
npm run viewer
```

The viewer is available at `http://127.0.0.1:5173`. The starter intentionally
ships with an incomplete review queue, so the first lint, verify, or finalization
attempt may stop at a named review gate after proving the rest of the local
pipeline. Complete those reviews through MCP, then repeat the same commands.

Playwright's standard `HTTPS_PROXY`, `PLAYWRIGHT_DOWNLOAD_HOST`, and
`PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` variables support proxies and offline
mirrors. The default `PLAYWRIGHT_BROWSERS_PATH=0` keeps the binary
package-local; set that variable to an explicit path for a configured shared
cache. To use a system browser deliberately, edit `automovie.config.ts`:

```ts
capture: {
  browser: { source: "system-channel", channel: "chrome" },
}
```

A `configured-executable` choice must declare both its product and path. Its
exact executable digest is then recorded in every render identity.

Render evidence records structured Playwright, browser, executable, platform,
headless/raster, backend, and actual WebGL identity. A browser/runtime change
therefore produces a different content-addressed bundle; legacy v2 evidence
must be recaptured.

The sample review queue is deliberately incomplete. Open the PNG printed by
`preview`, read the exact `REVIEW_ASSET`, `REVIEW_SHOT`, `REVIEW_SEQUENCE`, or
`REVIEW_FILM` contract through MCP, and review current evidence.

## Offline geometry measurements

Measurement scripts and tests may load the current project snapshot without an
MCP session:

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import { Vector3, formationSlot } from "@automovie/engine";

const loaded = loadAutoMovieProjectState({ root: process.cwd() });
const state = requireCurrentAutoMovieProjectState(loaded);
const formation = state.generated.design.formations.get("army")!;
const slot = formationSlot(formation, 31);
const landmark = state.generated.design.world.landmarks[0]!;
const meters = Vector3.length(
  Vector3.subtract(slot.position, landmark.position),
);
```

The loaded state includes the generated compile fingerprint, the fingerprint
recomputed from current inputs, the project revision, and an explicit
`current`, `stale`, or `missing` status. Always require current state before
calling pure engine reach, distance, camera, or formation functions.

The state reader performs filesystem I/O and is therefore forbidden inside
shot and film `build` functions. Those functions run in the deterministic
compiler sandbox. Keep the reader in standalone measurement scripts, tests, or
offline diagnostics and pass only loaded typed values into engine functions.

Claude Code loads the checked-in `.mcp.json` after one project approval. Other
MCP clients can import the same project-bound command. Its first call is
`getGuideDocument({name:"AUTOMOVIE_OVERALL"})`. `scripts/mcp.ts` fixes this
repository root and production id at host startup; tool payloads never switch
workspaces. Full render, chunk resume, encode, and final publication are project
CLI jobs, not free-form MCP shell tools:

```sh
npx automovie render plan
npx automovie render status
npx automovie render run --workers 2
npx automovie render verify
npx automovie render finalize
```

Use `--tier proxy` for a half-raster, stepped-frame review render and
`--tier final` (the default) for delivery. Both tiers reopen the same compiled
film timeline and publish under separate content-addressed paths, so a proxy
approval never overwrites the final bundle:

```sh
npx automovie render all --tier proxy
npx automovie render all --tier final
npx automovie render gc
npx automovie render gc --apply
```

`render gc` is a dry run unless `--apply` is explicit. It marks the current
proxy and final plans, stored review-evidence bundles, and every file named by
the current publication manifest. For chunk media it retains only a current
direct-root pointer and the exact immutable temporary tree authenticated by
that pointer; stale pointers, duplicate or unreachable trees, unreferenced
legacy chunks, quarantine entries, and stale publication bytes are reported.
Active lock, attempt, and live temporary records are never sweep candidates.
`render gc --apply` holds an exclusive render-job guard through its live-worker scan and sweep, while `plan`, `run`, `all`, and `finalize` hold session claims that make either start order fail closed before state mutation.
Render plans form an append-only generation chain under `plan.json.generations`: each predecessor has one immutable no-overwrite successor slot, so a stale or concurrent planner cannot remove either generation, while a legacy `plan.json` remains an immutable chain root authenticated by its persistent successor slot. Publication revalidates source/compiler/runtime inputs and the exact chain head immediately before reserving and writing the final slot through descriptor-bound `O_EXCL`. A render session keeps the captured plan object for scheduling, resume, receipt checks, status, and finalization even if another session appends a later plan.
Every descriptor-bound render final slot remains visible once creation begins. Write, fsync, readback, target, parent, or root validation failures never trigger automatic pathname cleanup; strict consumer gates and explicit GC or manual adjudication handle partial or ambiguous evidence without deleting a relinked successor.
If a candidate changes at the quarantine boundary, GC fails closed and leaves the observed successor under a top-level `.gc-preserved-*` directory. That reserved evidence is excluded from later automatic GC runs; inspect it and adjudicate it manually before reusing or deleting it.
Routine worker recovery also keeps each verified file or directory at its private `.gc-preserved-*` path. The public `quarantine/` entry is a strict immutable marker that binds the original path, preserved path, kind, physical identity, and content fingerprint; it is published directly through `O_EXCL`, so a destination competitor or marker successor is never replaced.
Valid quarantine markers resolve private evidence relative to their proxy or final ownership tier and are inventoried as one GC candidate with combined reclaimable bytes. Apply captures the private container while it still owns the evidence, then removes the evidence first, its captured marker second, and that same container only if it remains empty; a container pathname successor is preserved. Invalid marker content leaves private evidence outside automatic deletion, and duplicate physical references across tiers remain untouched for manual adjudication.
Guide-pass publication includes both its MP4 and authenticated
`frames/<pass>/frame_XXXXXXXX.png` control images.
Proxy finalization keeps every manifest path materialized as an ordinary file inside its content-addressed directory. It creates missing directories monotonically without ever deleting or replacing a partial or competing tree, then reserves and writes every final payload pathname directly through descriptor-bound `O_EXCL` with `publication.json` last. Existing exact files converge safely, foreign files fail closed, and interrupted direct slots remain visible for explicit adjudication without a candidate hard-link alias. GC retains a proxy publication only after its cached captured receipt and exact directory snapshot pass self-described verification, so pathname ABA cannot change the adjudicated generation.

Finalization derives semantic sound effects from compiled shot events, samples their emitters relative to the active camera, mixes authored score cues and caption-timed dialogue at 48 kHz stereo, and encodes deterministic Opus without a host `ffmpeg`.
Dialogue uses the local Kokoro ONNX Runtime CPU adapter and caches each normalized line by content, model, voice, and inference settings, so changing one line invalidates only that line. Each cache key owns one immutable directory that publishes `audio.f32` first and `receipt.json` last through descriptor-bound `O_EXCL`; cache hits capture and revalidate the exact two-file directory generation instead of combining independent sibling path reads.
The checked-in `.npmrc` disables ONNX Runtime's Linux CUDA download because this renderer deliberately selects the CPU execution provider; the installed platform-native CPU binding and shared libraries remain part of every sound runtime and cache fingerprint.
The project pins the verified Kokoro and Transformers.js versions and overrides Transformers.js's Node-only Sharp image dependency with the bundled TTS capability wall.
Kokoro's text/audio path remains local, while an accidental image-pipeline call fails explicitly instead of installing a non-permissive native image payload.
The audio deliverable owns `audio.mp4`, waveform and spectrogram PNGs, and parser-verified clipping/event-alignment evidence.
The feature MP4 muxes that exact audio with H.264 video; final media probing refuses video-only feature output or unequal A/V runtimes.
For `visualDelivery: "repainted"`, finalization conforms the exact active,
reviewed repaint clips and records their receipt plus source/rendition/aggregate
review fingerprints. The current conformer accepts full-shot, cut-only,
single-decoder-configuration clips, preserves their rational clock and
conformable B-frame presentation order, and fails explicitly for unsupported
edits; it never substitutes deterministic feature pixels.

`status`, `verify`, and `finalize` re-run the package-owned capture, actual
graphics, declared render-source, and encoder identity preflight. They may
launch Chromium; any identity change marks the stored chunks stale instead of
mixing or misattributing output from two runtimes.

Chunk workers publish complete UUID claims atomically inside a slot-specific
lock namespace. A worker yields to every other live claim and removes only its
own exact path. Interrupted pre-publication candidates are quarantined on the
next run. A completed unique temp tree stays immutable in place, while a
descriptor-written `O_EXCL` pointer at the physical project root publishes its
full receipt and content fingerprint last. Receipt reuse binds that exact pointer
to one exact tree; finalization consumes its frame and MP4 descriptors without
reopening verified paths. Abandoned recovery never quarantines a tree reached by
a valid current pointer.

Each running attempt is authorized by the exact physical snapshot and `{ chunk, pid, token }` bytes of its held chunk lock, then reserves and writes its final record pathname directly through descriptor-bound `O_EXCL`. Dead-owner recovery and the running-to-failed transition remove only an exact captured predecessor before reserving the successor slot, while successful cleanup remains lock-bound; a root, parent, lock, attempt, or competing final-slot successor is preserved. Status and explicit GC read the same strict versioned attempt schema instead of trusting generic JSON pathnames.
Each chunk worker also reserves and writes its unique final claim pathname directly through descriptor-bound `O_EXCL`. The returned exact snapshot is reused for the worker's own scan, owner validation, held-lock authorization, attempt binding, and release; no candidate hard link or candidate cleanup can publish or delete a pathname successor. Legacy `.candidate` entries remain recovery-only evidence for older interrupted jobs.

Final conform also reopens the matching proxy bundle as one physical tree. Its
manifest must account for the exact regular-file inventory, and every declared
payload length and digest must still match before the proxy can satisfy the final
plan gate.

`npm run render` is the convenience sequence: it captures current review evidence,
reuses or renders current chunks, then attempts final publication. Finalize
still fails closed until every current review is complete. Its terminal commit
also fingerprints the revision, declared content, live evidence-bound review
queue and records, generated manifest and bytes, production manifest, exact
design graph, and state incarnation with canonical structured fields. The
staged final compiler gate recomputes that review queue from current render
evidence; any change during the gate rolls the publication back.

Run `npm run verify` (or `npx automovie verify`) after publication to reopen the
generated inventory, evidence-bound reviews, render receipts, and actual
delivery bytes without modifying project state. It fails on damaged generated
output, stale or forged receipts, and missing required deliverables.

Claude Code loads `.claude/settings.json` and checks every `PreToolUse`,
including direct edits, Bash, and MCP file tools, against compiler-owned
generated output, render output, capture receipts, and production state.
Nearest existing ancestors are resolved physically, so a symlink or junction
cannot disguise an owned target. The refusal names the owning project command.
The hook deliberately does nothing when `.automovie/manifest.json` is absent,
so copying it outside an AutoMovie project does not claim unrelated files.

The production viewer accepts `?film=1` for GPU cut/dissolve playback of the
compiler-owned EDL, `?shot=<id>` for one shot, and
`?asset=<model-id>&angle=<degrees>&elevation=<degrees>` for an isolated model
turntable. The reusable capture session opens each target/raster page once and
seeks subsequent frames in place; render output reports page, navigation,
seek, and capture counts so throughput improvements remain measurable.

## Ownership

- `.automovie/design/shared`: project-shared model, world and formation design
- `.automovie/design/<production>`, `.automovie/reviews/<production>`:
  production-scoped tracked contracts
- `.automovie/productions/<production>`: production-scoped compiler, render-job,
  receipt and revision state
- `src`, `docs`, `test`, `public`: coding-agent source and assets
- `generated`: compiler-owned; never edit
- `renders`: content-addressed outputs; never pass an arbitrary screenshot as review evidence

`npm run lint:source` type-checks source and runs the registered `@ttsc/lint`
contributors without modifying project state. `npm run lint` runs that source
lint first, then runs the production compiler through the review gate in
read-only mode. It deliberately fails while any design, source, shot, or film
review is missing, stale, revising, or incomplete. `npm run compile` is the
narrower production source gate and the only command that may update generated
output.
