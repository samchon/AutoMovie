# {{name}}

This is a coding-agent-first AutoMovie production repository. Author production facts, construction and final screenplay documents, source, assets, and delivery indexes as ordinary tracked files. Production execution consumes typed source directly.

## Authoring routes

The generated `AGENTS.md` reports the current production kind, active branches, owners, and selected contract bindings. It routes contract lookup through the [contract skill](.agents/skills/contract/SKILL.md), production work through [production lifecycle](.agents/skills/production-lifecycle/SKILL.md), graph changes through [evidence graph](.agents/skills/evidence-graph/SKILL.md), implementation through [source authoring](.agents/skills/source-authoring/SKILL.md), and observation or completion through [review verification](.agents/skills/review-verification/SKILL.md).

Use [Production kinds](.agents/skills/production-lifecycle/production-kinds.md) before selecting `kind` in `src/lint.config.ts`. Use [Production documents](docs/README.md) for physical document ownership, [Contract targets](.agents/skills/evidence-graph/contract-targets.md) for shared and language target forms, [Production-specific contract](.agents/skills/evidence-graph/work-specific.md) for local discovery results, and [Evidence staging](.agents/skills/evidence-graph/staging.md) before changing a branch stage or evidence annotation. Those routes own their semantics; this README only makes them reachable.

## Static-document updates

This README and `docs/README.md` are tracked snapshots installed when a new scaffold is created. `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` are also version-controlled project files. Instruction synchronization replaces that instruction surface; inspect and commit its changes together with the production declaration that caused them. Compare and adopt other scaffold revisions explicitly under source control, preserving production-owned documents, source, and assets.

Use ordinary coding-agent tools for authoring. Scaffold creation and instruction synchronization do not register an MCP client or write client configuration.

## First run

```bash
npm install
npm run lint
```

The blank scaffold is intentionally incomplete. Select the production kind through the routed lifecycle procedure, author its prerequisites, then use the commands below at the stages their linked procedures name.

## Canonical command routes

Use the commands declared in `package.json`:

| Command | Purpose |
| --- | --- |
| `npm run lint` | Check the complete TypeScript program and active authored evidence. |
| `npm run format` | Format source with the configured compiler formatter. |
| `npm run sync` | Replace generated instructions from tracked production facts. |

The scaffold provides instructions, contracts, and source lint, not prewritten production or viewer code. Author only the concrete source the requested work needs through the packages' public APIs. It supplies no film build, capture, render, or publication command.

The installed `automovie` CLI separately provides Markdown TOC maintenance, external-asset inspection, and capability routes. Read its local help before invoking a command. These operations do not authorize a project state store.

## Visual work

When the task needs a model view, building walkthrough, or film playback, follow [Live viewing](.agents/skills/review-verification/live-viewing.md) to implement the required view over the production's own source. A page and its controls are authored for that need, not selected from seeded viewer templates.

## Ownership

- All source code belongs under `src`, including command entry points, viewer code, configuration modules, review declarations, and any test source. Source location does not make tooling a production design owner; the typed evidence declaration selects the authored populations.
- `public` holds HTML and static assets. Keep executable code in imported `src` modules rather than inline HTML scripts or asset directories.
- `docs` holds authored decisions, contracts, and review observations. Git holds change history. Neither is replaced by a generated state ledger.
- `package.json` is the only project JSON file. Keep package and compiler settings there; do not create another JSON configuration, design store, registry, migration journal, receipt, or cache file in the project.
- Execute production and measurement functions over typed values. Images, media, and reader-facing documents are outputs; serialized project state is not an authoring product.

Run the applicable [Author process Self-Review](.agents/skills/review-verification/self-review.md) before handing off a completed authoring, evidence, review, or stage-transition boundary.
