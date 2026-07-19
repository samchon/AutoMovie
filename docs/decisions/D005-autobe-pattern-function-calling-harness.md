# D005. The function-calling harness follows the AutoBe pattern

## Decision

Model the agent-facing harness on AutoBe: the LLM emits a structured artifact against a typed schema, a deterministic validator judges it, and the located violations feed back for correction. The harness types live in `packages/interface/src/harness/`.

## Why

AutoBe had already proven the shape that matters here — a compiler-grade gate in the loop beats prompt engineering, because the model gets an error it can locate and repair instead of a quality score it can only guess at. automovie's engine is that gate for motion.

## Where it binds

- `packages/interface/src/harness/` — `IAutoMovieScriptNode`, `IAutoMoviePropSpec`, and the rest of the harness surface.
- `packages/mcp/src/AutoMovieApplication.ts` — the validated tool surface built on it.

## Relations

Updated by [D014](./D014-heterogeneous-graph-structured-cot.md): automovie's chain of thought is graph-structured and heterogeneous where AutoBe's is uniform. Divergence noted where it happens; the harness shape is still inherited.

@author Samchon
