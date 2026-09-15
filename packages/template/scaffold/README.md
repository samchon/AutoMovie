# {{name}}

This is a coding-agent-first AutoMovie production repository. Author production facts, construction and final screenplay documents, source, assets, and delivery indexes as ordinary tracked files. Production execution consumes typed source directly.

## Authoring routes

The generated `AGENTS.md` reports the current production kind, active branches, owners, and selected contract bindings. It routes contract lookup through the [contract skill](.agents/skills/contract/SKILL.md), production work through [production lifecycle](.agents/skills/production-lifecycle/SKILL.md), graph changes through [evidence graph](.agents/skills/evidence-graph/SKILL.md), implementation through [source authoring](.agents/skills/source-authoring/SKILL.md), and observation or completion through [review verification](.agents/skills/review-verification/SKILL.md).

Use [Production kinds](.agents/skills/production-lifecycle/production-kinds.md) before selecting `kind` in `src/lint.config.ts`. Use [Production documents](docs/README.md) for physical document ownership, [Contract targets](.agents/skills/evidence-graph/contract-targets.md) for shared and language target forms, [Production-specific contract](.agents/skills/evidence-graph/work-specific.md) for local discovery results, and [Evidence staging](.agents/skills/evidence-graph/staging.md) before changing a branch stage or evidence annotation. Those routes own their semantics; this README only makes them reachable.

## Static-document updates

This README and `docs/README.md` are tracked snapshots installed when a new scaffold is created. Instruction synchronization replaces only the ignored `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` surface. Compare and adopt tracked scaffold revisions explicitly under source control, preserving production-owned documents, source, and assets.

Use ordinary coding-agent tools for authoring. Scaffold creation and instruction synchronization do not register an MCP client or write client configuration.

## First run

```bash
npm install
npm run lint:source
```

The blank scaffold is intentionally incomplete. Select the production kind through the routed lifecycle procedure, author its prerequisites, then use the commands below at the stages their linked procedures name.

## Canonical command routes

The executable command keys live in `package.json`; this table accounts for every script exactly once and provides its human route. Change the manifest and this inventory together.

| Script | Command route | Purpose or procedure |
| --- | --- | --- |
| `build` | `npm run build` | Compatibility alias for the compile route. |
| `building:report` | `npm run building:report` | Building measurements; follow [Measurements](.agents/skills/review-verification/measurements.md). |
| `book` | `npm run book -- --layer <layer> --title <title>` | Ignored reader edition; follow [Production lifecycle](.agents/skills/production-lifecycle/index.md#working-memory-and-reader-editions). |
| `capture:doctor` | `npm run capture:doctor` | Verify the installed capture runtime; follow [Capture](.agents/skills/review-verification/capture.md). |
| `capture:install` | `npm run capture:install` | Install the project capture runtime; follow [Capture](.agents/skills/review-verification/capture.md). |
| `derive:example` | `npm run derive:example` | Run the non-production derivation specimen; follow [Ownership](.agents/skills/source-authoring/ownership.md). |
| `design` | `npm run design` | Emit reviewed design records; follow [Source authoring](.agents/skills/source-authoring/index.md). |
| `external:inspect` | `npm run external:inspect -- <project-path> --profile <profile>` | Inspect external model or motion facts; follow [Models and motions](.agents/skills/source-authoring/models-and-motions.md). |
| `format` | `npm run format` | Apply the configured source formatter. |
| `inspect` | `npm run inspect -- --shot <id> --subject <kind:id>` | Inspect one compiled subject; follow [Inspection](.agents/skills/review-verification/inspection.md). |
| `lint` | `npm run lint [-- --scope <scope>]` | Run source and graph lint at `design`, `source`, `review`, or `final` scope; follow [Evidence staging](.agents/skills/evidence-graph/staging.md). |
| `lint:source` | `npm run lint:source` | Type-check governed source and run registered lint contributors. |
| `preview` | `npm run preview -- --shot <id> --time <seconds> --pass <pass>` | Capture a current shot frame; follow [Capture](.agents/skills/review-verification/capture.md). |
| `reference` | `npm run reference -- --request '<JSON>'` | Read-only authored Markdown navigation; follow [Read-only authored reference](.agents/skills/production-lifecycle/index.md#read-only-authored-reference). |
| `repaint` | `npm run repaint -- <action> --shot <id> [options]` | Use `reroll`, `retry`, `select`, or `reverse`; follow [Production delivery decisions](.agents/skills/production-lifecycle/configuration.md). |
| `render` | `npm run render -- <action> [options]` | Use `all`, `plan`, `run`, `status`, `verify`, `finalize`, or `gc`; follow [Review verification](.agents/skills/review-verification/index.md). |
| `routes` | `npm run routes -- <kind>` | Inspect supported capability ownership for `film`, `brief`, or `library`; follow [Production delivery decisions](.agents/skills/production-lifecycle/configuration.md). |
| `sync` | `npm run sync` | Replace generated instructions; follow [Generated instructions](.agents/skills/production-lifecycle/index.md#generated-instructions). |
| `texture:scale` | `npm run texture:scale` | Measure bound texture scale; follow [Measurements](.agents/skills/review-verification/measurements.md). |
| `toc` | `npm run toc -- --check` or `npm run toc` | Check or regenerate script, construction-screenplay, and final-screenplay delivery indexes; follow [Scripts](.agents/skills/production-lifecycle/scripts.md), [Screenplays](.agents/skills/production-lifecycle/screenplays.md), and [Naturalness](.agents/skills/production-lifecycle/naturalness.md). |
| `turntable` | `npm run turntable -- --asset <id>` | Capture the required asset view set; follow [Capture](.agents/skills/review-verification/capture.md). |
| `viewer` | `npm run viewer` | Keep the compiled viewer open while source changes recompile and reload; follow [Live viewing](.agents/skills/review-verification/live-viewing.md). |
| `viewer:preview` | `npm run viewer:preview` | Inspect ttsc-emitted current source through a production-owned preview factory; follow [Live viewing](.agents/skills/review-verification/live-viewing.md). |

The table names entry points, not completion evidence. Read the linked procedure for accepted arguments, applicability, refusals, and the observation required before treating an execution as evidence.

## Source preview navigation

The source preview accepts optional `navigation` from `src/createPreview.ts`: `items` contain unique nonempty `id`, `label`, optional `group`, and optional `keywords`; `apply(id)` synchronously updates the shared camera and optional target. The common viewer owns search, grouped selection, result counts, and panel collapse. Searching does not change the view. Selecting an item applies it; **Go to view** applies the selected item again after free flight. The producer supplies data and view changes without constructing menu DOM. See [Live viewing](.agents/skills/review-verification/live-viewing.md) for the preview lifecycle and evidence boundary.

## Ownership

- All source code belongs under `src`, including command entry points, viewer code, configuration modules, review declarations, and any test source. Source location does not make tooling a production design owner; the typed evidence declaration selects the authored populations.
- `public` holds HTML and static assets. Keep executable code in imported `src` modules rather than inline HTML scripts or asset directories.
- `docs` holds authored decisions, contracts, and review observations. Git holds change history. Neither is replaced by a generated state ledger.
- `package.json` is the only project JSON file. Keep package and compiler settings there; do not create another JSON configuration, design store, registry, migration journal, receipt, or cache file in the project.
- Execute production and measurement functions over typed values. Images, media, and reader-facing documents are outputs; serialized project state is not an authoring product.
- `src/examples` is teaching material, not production content or evidence.

Run the applicable [Author process Self-Review](.agents/skills/review-verification/self-review.md) before handing off a completed authoring, evidence, review, or stage-transition boundary.
