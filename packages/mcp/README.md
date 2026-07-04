# `@autofilm/mcp`

AutoFilm's deterministic film engine, exposed as **Model Context Protocol (MCP)**
tools.

Instead of the repository hosting its own LLM orchestration, the engine is a
**tool surface an external agent drives** (Codex, Claude, any MCP client). The
agent supplies the structured creative intent; the engine computes the
deterministic result and returns it — including the placement / ROM violations
that make the **engine, not the model, the arbiter of physical truth** ("engine
enforces, model creates").

Every tool's JSON schema is derived at compile time from
[`AutoFilmApplication`](./src/AutoFilmApplication.ts)'s method signatures and
JSDoc via `typia.llm.controller` (+ `@typia/mcp`), and calls are validated in and
out.

## Tools

| tool | in → out | engine |
|------|----------|--------|
| `stage` | script + staging → staged scene (or violations) | `stageScene` |

More of the pipeline (`block` / `perform` / `cut` / `forge`) follows — the
multi-stage, partly rig-dependent shape is the part we're still experimenting
with.

## Run

```bash
# dev (in-workspace, transpiled by ttsx)
pnpm --filter @autofilm/mcp start        # = ttsx src/bin.ts

# built (published): the bin runs the compiled server
npx @autofilm/mcp                        # = node lib/bin.js
```

## Configure an MCP client

```jsonc
{
  "mcpServers": {
    "autofilm": {
      "command": "npx",
      "args": ["@autofilm/mcp"]
    }
  }
}
```

For an in-repo checkout, point the command at the workspace runner instead
(`ttsx packages/mcp/src/bin.ts`).
