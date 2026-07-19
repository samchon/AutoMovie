# D012. The MCP server is a pure deterministic gate; the agent orchestrates

## Decision

The server computes and validates; it never decides what the film should be. It blocks out-of-order commits and names the next step, but it does not drive the loop. "Engine enforces, model creates."

The **project folder is the memory**. Unlike AutoBe's hidden `.autobe` JSON mirror, every slice here is a human-readable JSON file plus registered 3D assets — the state *is* the deliverable. Which slices persist is decided by that rule: compiled motions are re-perform-derived output, not a stored slice.

## Why

An orchestrating server and an orchestrating agent fight each other, and the agent always wins, because it holds the intent. Making the server a gate keeps the contract honest: it answers "is this valid, and what is missing", and it refuses to guess what the director wanted.

Making the project folder the memory means a reopened project is inspectable by a human with a text editor, diffable in review, and recoverable without the server that wrote it.

## Where it binds

- `packages/mcp/src/project/AutoMovieProject.ts` — human-readable slices, not a hidden mirror.
- `packages/mcp/src/project/AutoMoviePrerequisite.ts` — blocks wrong order and names the fix; still never orchestrates.
- `packages/mcp/src/services/CommitService.ts` — motions are not a persisted slice.
- `test/src/features/mcp/test_mcp_commit_shot_motion_registry.ts`.

## Relations

Its server shape is [D006](./D006-single-controller-mcp-surface.md). The refinement graph the violations file against is [D013](./D013-screenplay-is-a-refinement-graph.md).

@author Samchon
