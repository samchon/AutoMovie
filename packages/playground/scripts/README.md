# Regenerating `.shots` (GLB models + demo GIFs)

`.shots/` is **gitignored scratch** — everything in it is derived from the
playground's TypeScript AST, so it is regenerated, never committed. On a fresh
checkout the folder is empty; these scripts rebuild it.

All commands run from `packages/playground` (or via `pnpm --filter
@automovie/playground <script>`).

## Models (`.glb`)

Each character is exported straight from its `build*` AST through
`@automovie/render`'s `exportModelToGLB`:

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

## Capture smoke (`smoke:capture`, #1170)

The one REAL (non-faked) headless-capture check: Chrome renders the live
stickman page, the multi-pass adapter captures beauty/mask/pose twice, and the
frames are judged **structurally** (not byte-hashed against a golden file —
GPU rasterization differs across hosts): two sessions must be byte-identical
to each other, the mask must carry the exact segment color over a plausible
subject fraction on dominant black, the pose must draw white skeleton lines,
and beauty must differ from mask. Reuses a running dev server at `--base`
(default `http://127.0.0.1:5173`), else spawns and kills its own Vite. Needs
Google Chrome (`--chrome` / `CHROME` to override). Exits non-zero on any
failed check.

```bash
pnpm smoke:capture
```

## Render-and-see artifact (`.mp4` + `.json` + frames)

`render:see` is the render seam smoke path: it drives one playground route
through `@automovie/render`'s `createHeadlessCaptureAdapter` and `renderAndSee`,
then writes PNG frames, an MP4, and a JSON artifact describing frame paths,
sample times, ffmpeg-equivalent args, route, and encoder.

```bash
pnpm render:see
pnpm render:see -- --page stickman.html --query "char=human&clip=walk&az=80"
```

The same `CHROME` and `BASE` environment overrides apply. The default `BASE` is
`http://127.0.0.1:5173`. Defaults write under `.shots/_render-see/` and capture
the human walk route from `stickman.html`.

`render:sequence` does the same for the `film.html` sequence path. The page
exposes its committed `sequence` and `shots`, the script builds a
`planSequenceRender` manifest, then captures each manifest frame through the
page's sequence-frame hook. The JSON artifact includes the sequence timeline,
frame paths, encoded MP4 path, and a pixel probe for sampled dissolve frames.

```bash
pnpm render:sequence
pnpm render:sequence -- --fps 12 --out .shots/_render-see/film-sequence.mp4
```

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
