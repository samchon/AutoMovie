# Decision Records

The `D0xx` records in this directory are automovie's constitution. Shipped source cites them as binding authority — `(D015)` in a validator's JSDoc means that validator's severity is not a local judgement call but a project-level decision — so the records must be readable by anyone holding the repository, with no access to a maintainer's machine.

That is the whole reason this directory is version-controlled while `.wiki/` is not. `.wiki/07-decisions/` remains the maintainer's append-only working log, numbered `NNN-*.md` on its own sequence; it is scratch that happens to survive. The `D0xx` series here is the subset that shipped code binds itself to, and it is the only decision numbering a citation in `packages/*/src` may use.

Records are append-only. A later record may supersede an earlier one, and says so in its **Relations** section; the superseded record stays, because code that predates the change still reads against it.

## The records

| | Decision |
|---|---|
| [D001](./D001-face-editor-dormant-motion-first.md) | The face editor goes dormant; motion is the main line. |
| [D002](./D002-rough-interface-types.md) | Interface types stay rough — plain primitives, ranges in JSDoc, enforcement in `engine`. |
| [D003](./D003-named-scalars-for-llm-quaternions-for-engine.md) | Named semantic scalars for the LLM, quaternions for the engine. |
| [D004](./D004-engine-owns-its-math-layer.md) | The engine owns its math layer; `three.js` lives only in `viewer`. |
| [D005](./D005-autobe-pattern-function-calling-harness.md) | The function-calling harness follows the AutoBe pattern. |
| [D006](./D006-single-controller-mcp-surface.md) | One controller class is the whole MCP surface. |
| [D007](./D007-perform-reach-is-unclamped.md) | Reach in `perform` is unclamped; the ROM gate rejects it. |
| [D008](./D008-render-seam-isolated-in-render-package.md) | The deterministic render seam is isolated in `@automovie/render`. |
| [D009](./D009-motion-first-infinite-duration.md) | Motion first, infinite duration; appearance and audio go to diffusion. |
| [D010](./D010-physics-feedback-is-a-severity-tier.md) | Physics feedback is a severity tier, not a gate. |
| [D011](./D011-crude-proxy-rich-meaning.md) | Crude proxy, rich meaning. |
| [D012](./D012-mcp-is-a-gate-agent-is-the-orchestrator.md) | The MCP server is a pure deterministic gate; the agent orchestrates. |
| [D013](./D013-screenplay-is-a-refinement-graph.md) | The screenplay is one refinement graph; feedback cascades back up it. |
| [D014](./D014-heterogeneous-graph-structured-cot.md) | Chain of thought is graph-structured and heterogeneous. |
| [D015](./D015-physical-plausibility-is-a-suppressible-warning.md) | Physical plausibility is a suppressible warning; only impossibility is an error. |
| [D016](./D016-mcp-placement-semantic-euler.md) | MCP placement rotation is authored as semantic Euler degrees. |

## Citing a decision

Write the bare identifier — `(D015)` — in source JSDoc, tests, or the guide corpus. `test/src/features/docs/test_docs_decision_records.ts` scans every cited identifier and fails if it does not resolve to a record here, and fails if a record is missing from the table above. A citation cannot rot into a dangling reference, and a record cannot go unlisted.

## Adding a decision

Take the next free number, name the file `D0NN-<kebab-summary>.md`, and give it the standard sections: **Decision** (what was chosen, stated as a rule), **Why** (the reasoning that makes the rule usable — including the alternative rejected, when that is the load-bearing part), **Where it binds** (the files that would have to change if the decision were reversed), and **Relations** (what it follows from, supersedes, or is refined by). Add the row to the table in the same commit.
