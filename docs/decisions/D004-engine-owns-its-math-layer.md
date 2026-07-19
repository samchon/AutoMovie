# D004. The engine owns its math layer

## Decision

`@automovie/engine` implements its own `Vector3`, `Quaternion`, and `Matrix4` and does not depend on `three.js`. `three` is imported only inside `@automovie/viewer`.

## Why

The engine is the deterministic half of the product: the same inputs must yield the same frames on every host, forever. A rendering library's math types are tuned for rendering, evolve on the library's schedule, and would make the engine's numeric output hostage to a dependency bump.

Owning the math layer also keeps the engine runnable anywhere — a headless MCP server, a test process, a future native port — with no graphics stack present.

## Where it binds

- `packages/engine/src/math/` — `Vector3.ts`, `Quaternion.ts`, `Matrix4.ts`, `rotationBetween.ts`, `hull.ts`, `bisect.ts`, `segments.ts`.
- `packages/viewer/**` — the only package permitted to import `three`.
- `.agents/skills/development/SKILL.md` — "Respect package boundaries".

## Relations

Paired with [D008](./D008-render-seam-isolated-in-render-package.md), which isolates the other non-deterministic seam.

@author Samchon
