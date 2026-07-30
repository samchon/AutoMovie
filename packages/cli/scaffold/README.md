# {{name}}

This is a coding-agent-first AutoMovie production repository. Write treatment,
screenplay, shot builders, motion helpers, effects, audio integration, and tests
as ordinary files. AutoMovie owns bounded design, deterministic generated
output, geometry facts, actual-frame evidence, and review freshness.

Treatment and screenplay prose are under `docs/{{name}}`. Keep their exact
beat and `SCN-*` identities aligned with
`.automovie/design/screenplay/index.json`; once shots exist, retain locked
numbers, use `OMITTED` tombstones for deletions, and alpha ids for insertions.
`pnpm lint` checks those joins and requires compiled realization plus completed
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

Frame capture defaults to the Chromium build pinned to this project's Playwright
version. Installation is explicit rather than a hidden dependency
postinstall. The ignored receipt binds the package version, browser revision,
executable path, and executable digest; the doctor launches that exact binary,
requires WebGL, captures a canvas, and decodes the PNG.

```bash
pnpm install
pnpm capture:install
pnpm capture:doctor
pnpm compile
pnpm test
pnpm preview -- --shot opening --time 2 --pass beauty
pnpm review:status
```

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
`preview`, read `PRODUCTION_REVIEW` through MCP, and review current evidence.

Register `automovie.mcp.jsonc` with your coding agent. Its first call is
`getGuideDocument({name:"AUTOMOVIE_OVERALL"})`, then `openProject` with this
repository root. Full render, chunk resume, encode, and final publication are
project CLI jobs, not free-form MCP shell tools:

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
the current publication manifest, then reports unreferenced chunks, quarantine
entries, and stale publication bytes. Active lock and attempt records are
never sweep candidates.
Guide-pass publication includes both its MP4 and authenticated
`frames/<pass>/frame_XXXXXXXX.png` control images.

`status`, `verify`, and `finalize` re-run the package-owned capture, actual
graphics, declared render-source, and encoder identity preflight. They may
launch Chromium; any identity change marks the stored chunks stale instead of
mixing or misattributing output from two runtimes.

Chunk workers publish complete UUID claims atomically inside a slot-specific
lock namespace. A worker yields to every other live claim and removes only its
own exact path. Interrupted pre-publication candidates are quarantined on the
next run. Receipt reuse rejects linked state ancestors and files, and final
encoding consumes the exact PNG bytes authenticated by that physical-path read.

`pnpm render` is the convenience sequence: it captures current review evidence,
reuses or renders current chunks, then attempts final publication. Finalize
still fails closed until every current review is complete. Its terminal commit
also fingerprints the revision, declared content, live evidence-bound review
queue and records, generated manifest and bytes, production manifest, exact
design graph, and state incarnation with canonical structured fields. The
staged final compiler gate recomputes that review queue from current render
evidence; any change during the gate rolls the publication back.

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

`pnpm lint` type-checks source and runs the production compiler through the
review gate in read-only mode. It deliberately fails while any design, source,
shot, or film review is missing, stale, revising, or incomplete. `pnpm compile`
is the narrower source gate and the only command that may update generated
output.
