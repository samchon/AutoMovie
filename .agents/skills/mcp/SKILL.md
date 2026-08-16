---
name: mcp
description: Defines the design rules for packages/mcp: what the tool surface is and is not allowed to do for its client, server/tool arrangement as an ongoing experiment, and the hard JSDoc-length constraints MCP clients impose. Use before adding or reshaping an MCP tool or its documentation.
---

# MCP Server Design

`packages/mcp` (`@automovie/mcp`) exposes the deterministic motion-control engine as Model Context Protocol tools: an external agent (Codex, Claude, any MCP client) drives the pipeline directly instead of the repo hosting its own LLM orchestration. The rule is "engine enforces, model creates" turned inside out.

Each class (a `typia.llm.controller`) is one MCP server; each public method is one validated tool, its JSON schema and validation derived from the method's TypeScript signature and JSDoc via `@typia/mcp`.

## The surface tells; it does not make

The tools are a knowledge and evidence boundary, not an authoring API. A client asks what the invariants are and what the frames actually show, then writes its own screenplay, subjects and assets as ordinary repository TypeScript. Two rules follow.

- **No tool builds the client's assets.** The server hands over no chair, building or costume, however convenient that would be; which assets a production has is the production's decision, under the project skill's [Capability, Not Content](../project/SKILL.md#capability-not-content) rule.
- **No giant authoring DTO.** Normal authoring is a loop, a class, a utility. Folding that into one enormous call trades reuse, typing, diffs and review for a JSON blob, and grows the surface faster than the guides can teach it.

When a client cannot author something it reasonably should, the answer is the missing engine or renderer capability plus the guide that teaches it, never a tool that produces the thing on the client's behalf. What this surface is for is delivering knowledge at the moment it is needed: a refusal carrying the name of the invariant it enforces, and a document the client can then read.

## Server/tool arrangement is not settled

How many servers, and how tools group across them, is a **standing design question, not a one-time decision**.
Today canonical `AutoMovieApplication` is the evidence surface: `getGuideDocument`, `captureFrame`, `captureTurntable`, `repaintShot`, `inspectSubject`, `prepareReview`, and `submitReview`.
Ordinary screenplay and shot implementation, design records, deterministic compilation, geometry inspection, status, migration, tests, and render orchestration stay in repository code or package/CLI APIs.
The former legacy, granular, gateway, and production application families are retired, and `automovie-mcp` is the only MCP binary.
Whenever this surface changes:

- Think deeply about the split before coding -- one server vs. several, one tool per engine call vs. coarser/finer groupings -- and write down the reasoning (a `.wiki/07-decisions/` entry or PR description).
- Then **experiment**: build it, verify with a live MCP client handshake (see `packages/mcp/README.md`), and keep iterating. Do not treat the current shape as final; revisit it as more of the pipeline (review, multi-shot orchestration) gets wired.

## Two hard length constraints

A class's JSDoc becomes the MCP server's **instructions**, and a method's JSDoc becomes its tool's **description**. Both flow straight from source comments via `typia.llm.controller`, so writing them is an API design act, not incidental documentation.

- **Server instructions (class JSDoc): lead with the core in the first 512 characters.** Codex reads only that many characters to decide whether to use the server at all, so the opening sentences must name what the server is for and what its tools do (an inverted pyramid, not a build-up). Elaboration belongs after that window, not before it.
- **Tool description (method JSDoc): the description body must not exceed 1023 characters.** This is enforced, not a style preference. Measure it (the plain-text description before the first `@` tag, whitespace-collapsed) before committing a method doc addition or rewrite.

When adding or rewriting either, count the actual rendered description length rather than eyeballing it. A `/** */` block's markdown/line-wrap does not map 1:1 to character count.

## Other conventions

- `packages/mcp` is outside the repository contract graph. Its `lint.config.ts` runs `evidence/documented` and `evidence/todo` only, so a comment on this surface states what the tool does for its client and cites nothing; the [evidence-graph skill](../evidence-graph/SKILL.md) owns the reason and the recorded cost.
- Each public method delegates its whole implementation to a service class or namespace function under `src/production`, so `AutoMovieApplication` reads as the contract a client is shown. Add a tool by writing the service and one delegating method, never by growing a method body.
- A PR that adds or changes an MCP tool checks whether the guide corpus (`packages/mcp/prompts/`) needs the same change (see `packages/mcp/prompts/README.md`); a guide that does not know a tool teaches only the expensive corrections.
- A PR that touches the MCP surface or package wiring runs `pnpm run e2e:tgz` (`internals/e2e-tgz.mjs`). It packs the published chain, installs the tarballs fresh, and drives the packaged bin over stdio, catching `files`/`bin`/publishConfig regressions the in-repo gate cannot. Slow and network-dependent, so it stays outside the c8 coverage gate.
- An MCP tool's return must be a single object type, never a bare union. The engine's success/violations unions are each wrapped (`IAutoMovieStageOutput { staged: IAutoMovieStagedSet }`) rather than returned directly.
- Do not expose tuple types directly on the MCP surface. `typia.llm.controller` rejects them; use named object fields such as `{ x1, y1, x2, y2 }` or omit the unsupported control from the MCP contract.
- The old per-stage `typia.llm.application<IAutoMovie*Application>()` interfaces are retired as the integration surface. The `IAutoMovie*Application.IWrite`/`IProps` types stay as the plain data shapes the class methods consume.
