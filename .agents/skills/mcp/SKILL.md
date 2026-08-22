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

## A claim the compiler can decide is not a review criterion

Review is expensive: it costs frames, a worksheet, and an agent's judgment, and every one of its verdicts stales when anything upstream moves. So the boundary worth defending is not "what could a reviewer look at" but **what can only be settled by looking**.

Two requirements already set that boundary, and they point the same way. `docs/requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance` asks a story success condition to carry a subject, a time or event, an observable state, and a failure condition, and forbids it ending in a bare evaluative word. `docs/requirements/story/scenes-and-observable-action.md#story-scene-observability` forbids resting acceptance on inner facts a camera cannot see. A claim that satisfies the first is, by construction, a predicate; a claim that needs the second is, by construction, pixels.

Sort the current review surface by that test and it splits cleanly.

| Kind | Criteria | Settled by |
| --- | --- | --- |
| `source` | `binding-and-exports`, `determinism`, `engine-enforcement`, `error-and-boundary-paths` | reading the module (no frames, as `REVIEW_DEPENDENCY` states) |
| `design` | `identity-and-references`, `scope-and-ownership`, `constraints-and-ranges`, `downstream-consumability`, `acceptance-coverage` | the records and the prepare-time diagnostics |
| `shot` | `acceptance-scenarios` | already the compiler's: `realizeShotContract` returns an explicit outcome per authored opening, closing, event, camera, actor, and formation predicate, and the worksheet only quotes it |
| `shot` | `beat-fidelity`, `representability` | partly the compiler's, once the claim is addressed and timed |
| `shot` | `staging-readability`, `performance-credibility`, `style-intent-justification` | looking, and nothing else |
| `rendition` | `visual-fidelity-to-source`, `temporal-coherence`, `anatomy-and-artifact-integrity`, `reference-consistency` | looking |
| `asset`, `subject`, `sequence`, `film` | silhouette, rig and material, coverage, rhythm, tone | looking |

The first three rows are work an agent is currently asked to certify by reading, and a compiler decides better: it does not tire, does not stale, and reports the exact figure that disagrees.

The share is not marginal. Measured on a freshly generated production with `test/src/features/mcp/measureReviewQueueShape.ts`, the review queue holds 20 entries: 10 `design`, 4 `asset`, 2 `shot`, 2 `sequence`, 1 `source`, 1 `film`. **Eleven of the twenty are `design` or `source`**, the two kinds that return no frames at all. Fewer than half of a production's review obligations are about anything anyone has to look at.

What stays is a real constraint rather than a leftover. `#story-falsifiable-acceptance` also requires that acceptance identify its **evaluating subject**, and that criteria never declare their own success. A compiled predicate satisfies that because the engine is not the author. A silhouette that fails to read has no predicate, so its evaluator is an agent looking at a frame, and that verdict has to exist and be attributable. The tools keep producing those pixels; what shrinks is the set of questions a verdict is asked to answer.

So when a review criterion keeps producing the same class of finding, the question is whether it is a diagnostic in the wrong place. Three of `source`'s four now are, and the fourth says where the boundary sits:

- **Acceptance outcomes** were already the compiler's; the reviewer cites them rather than judging them.
- **A duration written into scene prose** must be one the realizing shot carries (`screenplay-scene-timing-unrealized`), which closed the last joint between the screenplay and the motion under it.
- **A shot build path's hidden inputs** are refused by `source-shot-nondeterministic`: a wall clock, unseeded randomness, or process state inside a shot module. `determinism` had been the one named criterion with no mechanical enforcement of its globals at all, discharged by an agent reading for it.
- **Imports were never open.** The compiler already walks the module's TypeScript AST and refuses an unsupported or dynamic one as `source-import-unsupported`, which is why the scan above covers globals and stops there. This is the shape of the mistake to avoid: a regex beside a parser looks like new coverage and is a second, worse spelling of a rule that already held. Measure what already refuses the case before writing the check that refuses it again.

One joint is measured and still open. A shot names the scene it realizes twice: once as an exact `@evidence script/00X.md#scene-anchor` in its JSDoc and once as `evidence[].scene` in its contract. Nothing checks that the two agree. The graph now requires every shot export to cite exactly one H3 scene, so zero or two owners fail, but swapping two fixture shots' citations still leaves coverage satisfied because the ledger never reads JSDoc. Closing the remaining semantic join means walking the module AST for the exported shot's tags and mapping each anchor through the index's `scenes[].path` and identity. `docs/principles/shots.md#contract-only-composition` keeps the author responsible for composing the reviewed scene contract until that cross-check exists.

This is not an argument for deleting review. It is the boundary that keeps review affordable: move every addressed, timed, observable claim into the compiler, and spend the frames on what only frames can answer.

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
