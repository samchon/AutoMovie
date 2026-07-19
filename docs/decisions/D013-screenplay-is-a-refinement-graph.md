# D013. The screenplay is one refinement graph; motion is its leaf; feedback cascades back up

## Decision

The script is a single refinement tree — intent at the root, refined downward through acts, sequences, and groups, to beats at the leaves. Compiled motion is the final leaf of that refinement, not a separate artifact beside the script. Physics feedback located on a leaf walks the ancestor chain back up to the screenplay, so a violation names *where in the screenplay* the correction belongs.

## Why

Without the cascade, a violation says only "this elbow clips". With it, the agent can ask the real question: is this the beat's own motion authoring, the parent group's choreography packing the actors too tight, or the scene's staging making the reach impossible in the first place? Fixing at the wrong level produces a film that keeps re-breaking one beat downstream.

Which level to actually fix stays the agent's call ([D012](./D012-mcp-is-a-gate-agent-is-the-orchestrator.md)) — the engine locates the chain, it does not choose the rung.

## Where it binds

- `packages/interface/src/harness/IAutoMovieScriptNode.ts` — one node of the refinement graph.
- `packages/interface/src/harness/IAutoMovieSlate.ts` — the tree on the slate.
- `packages/engine/src/film/scriptGraph.ts` — `scriptAncestors` walks the chain.
- `packages/engine/src/validation/validateScriptTree.ts` — the tree gate.
- `packages/interface/src/validation/IAutoMovieConstraintViolation.ts` — the `node` a violation is stamped with.
- `packages/mcp/src/services/CommitService.ts` — `commitShot` stamps each violation with the claiming node.
- `test/src/features/film/test_film_feedback_cascade.ts` — the cascade proof.

## Relations

The node payloads are heterogeneous by [D014](./D014-heterogeneous-graph-structured-cot.md).

@author Samchon
