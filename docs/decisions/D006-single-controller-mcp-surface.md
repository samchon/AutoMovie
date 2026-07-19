# D006. One controller is the whole MCP surface

## Decision

The MCP server exposes a single class — `AutoMovieApplication` — whose public methods become the tools via `typia.llm.controller` + `@typia/mcp`. The earlier per-stage application wrappers (a separate object per pipeline stage) are retired.

## Why

The tool list is the agent's entire view of the product. Splitting it across per-stage applications duplicated wiring, let the stages' shapes drift apart, and bought nothing the method list did not already give. One class means one place where a tool is added, described, and length-checked against the MCP client caps.

## Where it binds

- `packages/mcp/src/AutoMovieApplication.ts` — every tool is a method here.
- `packages/mcp/src/createAutoMovieMcpServer.ts` — the controller-to-server wiring.
- `.agents/skills/mcp/SKILL.md` — the 512-character instruction lead and 1023-character tool-description caps this arrangement must respect.

## Relations

Implements the server half of [D012](./D012-mcp-is-a-gate-agent-is-the-orchestrator.md).

@author Samchon
