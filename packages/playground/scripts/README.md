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

## Demo clips (`.mp4`)

The clips are deterministic captures of the viewer pages, encoded straight to
H.264 MP4 in-process (no ffmpeg). One **persistent** headless-Chromium session
(Playwright) loads each page once, then `window.__afSeek(t)` (the `?cap=1` hook
in every view) steps it to each frame and the canvas is screenshotted — so it
takes seconds per clip, not a browser relaunch per frame.

Needs:

1. **The dev server running** (separate terminal): `pnpm dev` (serves
   `http://localhost:5173`).
2. **Google Chrome** installed (driven via `executablePath`).

Then:

```bash
pnpm shots             # capture every clip in the manifest
pnpm shots shadowbox   # only shots whose output path matches "shadowbox"
```

Overrides via env: `CHROME=/path/to/chrome` (binary), `BASE=http://host:port`
(server). The shot list lives at the top of `capture-shots.mjs` — add a row
`[page, query, durationSeconds, frameCount, width, height, outPath, fps]` to
capture a new clip. Encoding uses `h264-mp4-encoder` (wasm) + `pngjs`.

## Head screenshots (`.png`)

The head editor needs two capture modes across many angles:

- `model`: canvas only, with the UI hidden, for socket and form inspection.
- `overlay`: viewport capture with the reference sheet alpha blended over it.

Run:

```bash
pnpm shots:head
```

Outputs overwrite the current cycle in `.shots/head/model/`,
`.shots/head/overlay/`, and `.shots/head-latest.png`.
