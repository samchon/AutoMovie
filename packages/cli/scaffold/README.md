# {{name}}

This is a coding-agent-first AutoMovie production repository. Write treatment,
screenplay, shot builders, motion helpers, effects, audio integration, and tests
as ordinary files. AutoMovie owns bounded design, deterministic generated
output, geometry facts, actual-frame evidence, and review freshness.

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

`status`, `verify`, and `finalize` re-run the package-owned capture, actual
graphics, declared render-source, and encoder identity preflight. They may
launch Chromium; any identity change marks the stored chunks stale instead of
mixing or misattributing output from two runtimes.

Chunk workers publish complete UUID claims atomically inside a slot-specific
lock namespace. A worker yields to every other live claim and removes only its
own exact path. Interrupted pre-publication candidates are quarantined on the
next run.

`pnpm render` is the convenience sequence: it captures current review evidence,
reuses or renders current chunks, then attempts final publication. Finalize
still fails closed until every current review is complete.

## Ownership

- `.automovie/design`, `.automovie/reviews`: AutoMovie tracked contracts
- `src`, `docs`, `test`, `public`: coding-agent source and assets
- `generated`: compiler-owned; never edit
- `renders`: content-addressed outputs; never pass an arbitrary screenshot as review evidence

`pnpm lint` type-checks source and runs the production compiler through the
review gate in read-only mode. It deliberately fails while any design, source,
shot, or film review is missing, stale, revising, or incomplete. `pnpm compile`
is the narrower source gate and the only command that may update generated
output.
