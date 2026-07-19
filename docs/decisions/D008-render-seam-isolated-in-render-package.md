# D008. The deterministic render seam is isolated in `@automovie/render`

## Decision

Everything where determinism meets the outside world — frame planning, headless capture, guide passes, video encoding, sidecar emission — lives in `@automovie/render`. The engine computes frames; `render` turns them into files.

## Why

Determinism has a boundary, and it should be one package thick. Capture depends on a browser, encoding on a codec, file layout on a filesystem — none of which the engine's math should ever touch. Isolating the seam means the engine stays host-independent and testable in pure TypeScript, while the parts that legitimately vary by host are contained where they can be audited.

## Where it binds

- `packages/render/src/plan.ts`, `headlessCapture.ts`, `renderVideo.ts`, `guidePasses.ts` — the seam itself.
- `packages/render/src/poseKeypointSidecar.ts`, `captionSidecar.ts`, `screenplay.ts` — the conditioning artifacts emitted alongside the frames.

## Relations

Paired with [D004](./D004-engine-owns-its-math-layer.md). The artifacts it emits serve the diffusion half of [D009](./D009-motion-first-infinite-duration.md).

@author Samchon
