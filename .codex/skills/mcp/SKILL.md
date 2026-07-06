---
name: mcp
description: Designing packages/mcp — server/tool arrangement as an ongoing experiment, and the hard JSDoc-length constraints MCP clients impose. Read before adding or reshaping an MCP tool.
---

# MCP Server Design

`packages/mcp` (`@automovie/mcp`) exposes the deterministic motion-control engine as Model Context Protocol tools: an external agent (Codex, Claude, any MCP client) drives the pipeline directly instead of the repo hosting its own LLM orchestration — "engine enforces, model creates" turned inside out. Each class (a `typia.llm.controller`) is one MCP server; each public method is one validated tool, its JSON schema and validation derived from the method's TypeScript signature and JSDoc via `@typia/mcp`.

## Server/tool arrangement is not settled

How many servers, and how tools group across them, is a **standing design question, not a one-time decision**. Today `AutoMovieApplication` holds the four wired stages (`stage`/`block`/`cut`/`forge`) in one class; `perform` (rig-dependent, not plain JSON) isn't wired yet. Whenever this surface changes:

- Think deeply about the split before coding — one server vs. several, one tool per engine call vs. coarser/finer groupings — and write down the reasoning (a `.wiki/07-decisions/` entry or PR description).
- Then **experiment**: build it, verify with a live MCP client handshake (see `packages/mcp/README.md`), and keep iterating. Don't treat the current shape as final; revisit it as more of the pipeline (`perform`, review, multi-shot orchestration) gets wired.

## Two hard length constraints

A class's JSDoc becomes the MCP server's **instructions**, and a method's JSDoc becomes its tool's **description** — both flow straight from source comments via `typia.llm.controller`, so writing them is an API design act, not incidental documentation.

- **Server instructions (class JSDoc): lead with the core in the first 512 characters.** Codex reads only that many characters to decide whether to use the server at all — so the opening sentences must name what the server is for and what its tools do (an inverted pyramid, not a build-up). Elaboration (architecture, what's not wired yet) belongs after that window, not before it.
- **Tool description (method JSDoc): the description body must not exceed 1023 characters.** This is enforced, not a style preference — measure it (the plain-text description before the first `@` tag, whitespace-collapsed) before committing a method doc addition or rewrite.

When adding or rewriting either, count the actual rendered description length rather than eyeballing it — a `/** */` block's markdown/line-wrap doesn't map 1:1 to character count.

## Other conventions

- An MCP tool's return must be a single object type, never a bare union. The engine's success/violations unions (`IAutoMovieStagedSet`, …) are each wrapped (`IAutoMovieStageOutput { staged: IAutoMovieStagedSet }`) rather than returned directly.
- The old per-stage `typia.llm.application<IAutoMovie*Application>()` interfaces are retired as the integration surface (see decision in `.wiki/07-decisions/`); the `IAutoMovie*Application.IWrite`/`IProps` types stay as the plain data shapes the class methods consume.
