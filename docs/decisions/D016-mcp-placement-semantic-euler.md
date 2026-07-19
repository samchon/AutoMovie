# D016. MCP placement rotation is authored as semantic Euler degrees

## Decision

`setPlacement` takes a node's rotation as semantic Euler degrees — `{x, y, z, order}` — never a raw quaternion. The MCP layer lowers the angles with `Quaternion.fromEuler`; the engine keeps quaternions internally.

## Why

This is [D003](./D003-named-scalars-for-llm-quaternions-for-engine.md) carried into placement, where it had been missing. An agent asked to turn a staged lamp to face the door can author `{y: 90}`. It cannot author `{x: 0, y: 0.7071068, z: 0, w: 0.7071068}` — and if it tries, a normalization error produces a silently skewed set with no violation to read.

It is also the user's second standing philosophy in practice: *go the orthodox way, however long it takes*. The expedient fix was to accept the quaternion and document the hazard; the correct one was to change the authoring vocabulary.

## Scope and remainder

`setPlacement` is complete under this decision. Two paths still reach quaternions by another route and are deliberate follow-ups, not oversights:

- `commitScene`'s scene, where `stage` generates rotation from `facingDeg`;
- `pose.root`, at keyframe depth.

## Where it binds

- `packages/mcp/src/convert.ts` — semantic Euler rotation becomes a quaternion.
- `packages/mcp/src/dto.ts` — `IAutoMovieEuler` degrees rather than a raw quaternion.
- `packages/mcp/src/AutoMovieApplication.ts` — `setPlacement` lowers it.
- `packages/mcp/prompts/project-memory.md` — "lowers the angles to a quaternion".

## Relations

Extends [D003](./D003-named-scalars-for-llm-quaternions-for-engine.md).

@author Samchon
