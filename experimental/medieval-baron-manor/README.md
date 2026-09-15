# medieval-baron-manor

This is a coding-agent-first AutoMovie production repository. Author production facts, documents, source, assets, and the screenplay index as ordinary tracked files; emit derived design records from reviewed source. AutoMovie owns deterministic generated output, render state, receipts, and review freshness.

## Authoring routes

The generated `AGENTS.md` reports the current production kind, active branches, owners, and selected contract bindings. It routes contract lookup through the [contract skill](.agents/skills/contract/SKILL.md), production work through [production lifecycle](.agents/skills/production-lifecycle/SKILL.md), graph changes through [evidence graph](.agents/skills/evidence-graph/SKILL.md), implementation through [source authoring](.agents/skills/source-authoring/SKILL.md), and observation or completion through [review verification](.agents/skills/review-verification/SKILL.md).

Use [Production kinds](.agents/skills/production-lifecycle/production-kinds.md) before selecting `kind` in `lint.config.ts`. Use [Production documents](docs/README.md) for physical document ownership, [Contract targets](.agents/skills/evidence-graph/contract-targets.md) for shared and language target forms, [Production-specific contract](.agents/skills/evidence-graph/work-specific.md) for local discovery results, and [Evidence staging](.agents/skills/evidence-graph/staging.md) before changing a branch stage or evidence annotation. Those routes own their semantics; this README only makes them reachable.

## Static-document updates

This README and `docs/README.md` are tracked snapshots installed when a new scaffold is created. `npm run sync` replaces the ignored `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` instruction surface and synchronizes local reference-client entries, while `npm run contracts:migrate` updates only the reusable target inventory owned by [Contract targets](.agents/skills/evidence-graph/contract-targets.md). Neither command overwrites these two tracked overview files. A package upgrade therefore does not silently adopt a later overview revision into an existing production; compare and adopt such a revision explicitly under source control.

Client registration is separately synchronized in ignored project-local `.mcp.json` and `.codex/config.toml`; unrelated settings are preserved and ownership conflicts refuse. See [Generated instructions](.agents/skills/production-lifecycle/index.md#generated-instructions) for first-client trust and recovery.

## Workspace setup and source regeneration

```bash
pnpm install
pnpm --filter medieval-baron-manor lint:source
pnpm --filter medieval-baron-manor derive:manor
pnpm --filter medieval-baron-manor build
```

Run these commands from the AutoMovie workspace root. This production is a pnpm workspace member, not a blank standalone npm project. The repository's `pnpm-lock.yaml` owns installation; do not create a second npm lock in this directory. The explicit manor derivation records its project-owned source and `package.json` inputs before the builder consumes its outputs. Repeat derivation after a generator, source, or installed workspace dependency changes. The source-preview website builds directly from authored source and textures; a successful preview does not prove that the separately derived production artifacts are current.

The large `automovie/derived/manor` JSON outputs remain ignored and are regenerated on a fresh checkout; the declared generators and `automovie/derived-artifacts.json` ledger are tracked. The `.cts` tool entrypoints run the existing ESM generators through one synchronous Node module graph, which keeps the workspace's CommonJS packages compatible with Three's ESM-backed entry on Node 22. `tsconfig.manor-tools.json` checks that tool dependency closure without adding unrelated browser JavaScript to the production source-lint population.

## Canonical command routes

The executable command keys live in `package.json`; this table accounts for every script exactly once and provides its human route. Change the manifest and this inventory together.

| Script | Command route | Purpose or procedure |
| --- | --- | --- |
| `build` | `npm run build` | Compile the current source and explicitly generated manor artifacts; follow [Compilation](.agents/skills/source-authoring/compilation.md). |
| `building:report` | `npm run building:report` | Building measurements; follow [Measurements](.agents/skills/review-verification/measurements.md). |
| `book` | `npm run book -- --layer <layer> --pass <construction|final> --title <title>` | Ignored reader edition; follow [Production lifecycle](.agents/skills/production-lifecycle/index.md#working-memory-and-reader-editions). |
| `capture:doctor` | `npm run capture:doctor` | Verify the installed capture runtime; follow [Capture](.agents/skills/review-verification/capture.md). |
| `capture:install` | `npm run capture:install` | Install the project capture runtime; follow [Capture](.agents/skills/review-verification/capture.md). |
| `contracts:migrate` | `npm run contracts:migrate -- --dry-run` or `npm run contracts:migrate` | Plan the shared-contract baseline change before applying its conflict-free actions. |
| `derive:example` | `npm run derive:example` | Run the non-production derivation specimen; follow [Ownership](.agents/skills/source-authoring/ownership.md). |
| `derive:manor` | `npm run derive:manor` | Regenerate the manor instance and environment artifacts from their declared source inputs. |
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
| `sync` | `npm run sync` | Replace generated instructions and synchronize owned local reference-client entries; follow [Generated instructions](.agents/skills/production-lifecycle/index.md#generated-instructions). |
| `texture:scale` | `npm run texture:scale` | Measure bound texture scale; follow [Measurements](.agents/skills/review-verification/measurements.md). |
| `toc` | `npm run toc -- --check` or `npm run toc` | Check or regenerate delivery index links; follow [Scripts](.agents/skills/production-lifecycle/scripts.md) and [Screenplays](.agents/skills/production-lifecycle/screenplays.md). |
| `turntable` | `npm run turntable -- --asset <id>` | Capture the required asset view set; follow [Capture](.agents/skills/review-verification/capture.md). |
| `verify` | `npm run verify` | Reopen and verify final generated, render, and delivery evidence; follow [Production review](.agents/skills/review-verification/review.md). |
| `verify:manor-openings` | `npm run verify:manor-openings` | Compare opening states and placements with current source, including unknown-state and missing-fill refusals. |
| `viewer` | `npm run viewer` | Keep the compiled viewer open while source changes recompile and reload; follow [Live viewing](.agents/skills/review-verification/live-viewing.md). |
| `viewer:preview` | `npm run viewer:preview` | Inspect ttsc-emitted current source through a production-owned preview factory; follow [Live viewing](.agents/skills/review-verification/live-viewing.md). |

The table names entry points, not completion evidence. Read the linked procedure for accepted arguments, applicability, refusals, and the observation required before treating an execution as evidence.

## Ownership

- `src`, `docs`, `test`, `public`, `lint.config.ts`, `scripts/emitDesign.ts`, and the screenplay index are project-owned inputs.
- `automovie/design/shared` and `automovie/design/<production>` are tracked design records emitted or authored through their declared owners.
- `generated`, `automovie/productions/<production>`, and `renders` are compiler or runtime outputs; do not edit them.
- `src/examples` and `npm run derive:example` are teaching material, not production owners or evidence.

Run the applicable [Author process Self-Review](.agents/skills/review-verification/self-review.md) before handing off a completed authoring, evidence, review, or stage-transition boundary.
