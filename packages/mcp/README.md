# `@automovie/mcp`

AutoMovie's deterministic motion-control engine, exposed as **Model Context
Protocol (MCP)** tools.

Instead of the repository hosting its own LLM orchestration, the engine is a
**tool surface an external agent drives** (Codex, Claude, any MCP client). The
agent supplies the structured creative intent; the engine computes the
deterministic result and returns it — including the placement / ROM violations
that make the **engine, not the model, the arbiter of physical truth** ("engine
enforces, model creates").

Every tool's JSON schema is derived at compile time from
[`AutoMovieApplication`](./src/AutoMovieApplication.ts)'s method signatures and
JSDoc via `typia.llm.controller` (+ `@typia/mcp`), and calls are validated in and
out.

## Tools

| tool | in → out | engine |
|------|----------|--------|
| `stage` | script + staging → staged scene (or violations) | `stageScene` |
| `block` | script + staged scene + blocking → blocked beat (or violations) | `blockBeat` |
| `cut` | assemble plan + performed shots → cut sequence (or violations) | `cutSequence` |
| `forge` | script + forge spec → generated cast models (or violations) | `forgeCast` |

`perform` is not exposed yet. It depends on a per-actor motion synthesizer and
rig resolver, so the exact MCP contract remains under test.

## Run

```bash
# dev (in-workspace, transpiled by ttsx)
pnpm --filter @automovie/mcp start        # = ttsx src/bin.ts

# built (published): the bin runs the compiled server
npx @automovie/mcp                        # = node lib/bin.js
```

## Configure an MCP client

```jsonc
{
  "mcpServers": {
    "automovie": {
      "command": "npx",
      "args": ["@automovie/mcp"]
    }
  }
}
```

For an in-repo checkout, point the command at the workspace runner instead
(`ttsx packages/mcp/src/bin.ts`).
