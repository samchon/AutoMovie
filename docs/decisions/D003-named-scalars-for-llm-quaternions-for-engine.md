# D003. Named scalars for the LLM, quaternions for the engine

## Decision

The authoring surface speaks in named semantic scalars — degrees on a named axis, a flexion angle, a facing heading. The engine computes in quaternions. Conversion happens once, at the boundary, on the way in.

## Why

An LLM cannot reliably author a unit quaternion, and a quaternion carries no meaning it can reason about: `{x: 0, y: 0.7071068, z: 0, w: 0.7071068}` is not "turn left 90°". Semantic angles are the vocabulary the model already has, and they make a violation legible when the engine rejects one.

The engine needs the opposite properties — no gimbal lock, stable composition, cheap interpolation — so it keeps quaternions internally and never leaks them upward.

## Where it binds

- `packages/mcp/src/convert.ts` — lowers semantic Euler rotation to `Quaternion.fromEuler`.
- `packages/mcp/src/dto.ts` — `IAutoMovieEuler` degrees on the authoring surface.
- `packages/engine/src/math/Quaternion.ts` — the internal representation.

## Relations

Follows [D002](./D002-rough-interface-types.md). Extended to node **placement** by [D016](./D016-mcp-placement-semantic-euler.md).

@author Samchon
