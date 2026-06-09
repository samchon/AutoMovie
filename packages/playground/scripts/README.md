# Regenerating `.shots` (GLB models + demo GIFs)

`.shots/` is **gitignored scratch** — everything in it is derived from the
playground's TypeScript AST, so it is regenerated, never committed. On a fresh
checkout the folder is empty; these scripts rebuild it.

All commands run from `packages/playground` (or via `pnpm --filter
@autofilm/playground <script>`).

## Models (`.glb`)

Each character is exported straight from its `build*` AST through
`@autofilm/render`'s `exportModelToGLB`:

```bash
pnpm build:models      # stickman, cat, horse, knight (all of the below)
# or individually:
pnpm build:stickman    # → .shots/human/stickman.glb
pnpm build:cat         # → .shots/cat/cat.glb
pnpm build:horse       # → .shots/knight/horse.glb
pnpm build:knight      # → .shots/knight/knight.glb
```

No browser needed — these run headless in Node.

## Demo clips (`.gif`)

The GIFs are deterministic screen captures of the viewer pages. They need two
things present:

1. **The dev server running** (separate terminal): `pnpm dev` (serves
   `http://localhost:5173`).
2. **Google Chrome** installed.

Then:

```bash
pnpm shots             # capture every clip in the manifest
pnpm shots shadowbox   # only shots whose output path matches "shadowbox"
```

Overrides via env: `CHROME=/path/to/chrome` (binary), `BASE=http://host:port`
(server). The shot list lives at the top of `capture-shots.mjs` — add a row
`[page, query, durationSeconds, frameCount, width, height, outPath, fps]` to
capture a new clip.

Each frame is a frozen `?t=<seconds>` sample, so re-running yields identical
output. Encoding uses `gifenc` + `pngjs` (already dev-dependencies).
