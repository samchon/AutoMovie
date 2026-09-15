# AutoMovie production

This is a coding-agent-first production repository. Author the requested film, model, or spatial work through ordinary documents and TypeScript. Read [project ownership](README.md#ownership) before adding files.

## Attitude

Follow the user's requested scope. Preserve production-owned facts and source, report observations truthfully, and correct the earliest owner of a defect before revising its dependents.

## Skills

### Contracts before authoring

Before drafting or changing production work, read [Contract](.agents/skills/contract/SKILL.md), the declaration in [src/lint.config.ts](src/lint.config.ts), and the applicable contract documents. The declaration selects the production's actual obligations; this entry point does not replace those contracts.

- Shared contracts live under `docs/discovery`, `docs/naturalness`, `docs/upstream`, `docs/principles`, and `docs/obligations`. [Contract targets](.agents/skills/evidence-graph/contract-targets.md) owns each family's meaning and the boundaries between them.
- The creation-selected language contracts live under `docs/language`. Follow the same [contract-target procedure](.agents/skills/evidence-graph/contract-targets.md) to select construction or final-language duties for the active work.
- User instructions and production-specific rules enter through [Production-specific contract](.agents/skills/evidence-graph/work-specific.md). That procedure owns their authority, canonical placement, discovery record, and activation through `claims`; do not assume that shared contracts already cover every direct instruction.

Use [Evidence staging](.agents/skills/evidence-graph/staging.md) when declaring which hosts answer a contract, adding citations, or advancing a stage. Use [Production documents](docs/README.md) to locate an authored owner rather than treating contract files as production content.

### Production work

- [Contract](.agents/skills/contract/SKILL.md) locates shared, language, and production-owned contract questions before interpreting or citing them.
- [Production lifecycle](.agents/skills/production-lifecycle/SKILL.md) owns shape selection, research, settings, pilots, narrative construction, and final screenplay naturalness.
- [Evidence graph](.agents/skills/evidence-graph/SKILL.md) owns the typed declaration in `src/lint.config.ts`, contract populations, citations, stages, and evidence review.
- [Source authoring](.agents/skills/source-authoring/SKILL.md) owns deterministic TypeScript realization, geometry, motion, spatial design, materials, and staging.
- [Review verification](.agents/skills/review-verification/SKILL.md) owns Self-Review, rendered observation, measurements, and completion claims.

## Maintenance

[Production documents](docs/README.md) maps document ownership. Follow [instruction updates](.agents/skills/production-lifecycle/index.md#generated-instructions) when production declarations or the installed authoring doctrine change. Claude Code loads this entry point through `CLAUDE.md`; Codex reads it directly.
