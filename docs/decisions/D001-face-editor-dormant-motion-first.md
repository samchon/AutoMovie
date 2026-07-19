# D001. The face editor goes dormant; motion is the main line

## Decision

Stop pursuing photoreal face/head likeness. The parametric head, face morph, and hair work in `forge` stays in the tree, complete and dormant, and the project returns to deterministic motion as its main line: stick-figure-grade assets performing verifiably correct movement.

## Why

A week of face-editor work did not reach human likeness, and the diagnosis was structural rather than effort-bound: "the rendered pixel is the photograph" puts the goal outside a deterministic rasterizer's reach. Appearance is diffusion's half of the split ([D009](./D009-motion-first-infinite-duration.md)); what diffusion cannot supply, and what no competitor was building, is **motion described as a structure a machine can validate**. That is automovie's ground.

Dormant is not deleted. The face pipeline is a finished capability held in reserve for when the surrounding technology justifies it.

## Where it binds

- `packages/engine/src/face/index.ts` — dormant face/head helpers, retained under this decision.
- `packages/interface/src/face/index.ts` — the dormant face/head document boundary.
- `packages/forge/src/index.ts` — the face/head morph exports, preserved rather than removed.

## Relations

Sets up [D009](./D009-motion-first-infinite-duration.md), which states the automovie/diffusion split this decision retreats to.

@author Samchon
