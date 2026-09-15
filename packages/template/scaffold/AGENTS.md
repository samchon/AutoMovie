# AutoMovie production

This is a coding-agent-first AutoMovie production repository. Its documents settle the requested work; its TypeScript forms and moves characters, objects, and spaces through a deterministic engine. The production may be a film, a bounded audiovisual brief, or a reusable model or spatial library.

AutoMovie's rendered result is a reproducible blocking pass whose geometry, staging, motion, and timing can be inspected. Do not mistake it for finished photoreal footage. Read [project ownership](README.md#ownership) before adding files and the production's settings before deciding what its delivery promises.

## Attitude

Follow the literal request; it is the contract, not a hint at what the user might prefer.

- **Scope belongs to the user.** Reinterpret the goal or expand the work only when the user delegates that decision. Within the agreed goal, investigate, implement, and verify the necessary substeps with full initiative.
- **Match the user's language.** Use the user's language for communication unless they request another. The production's selected language contract governs its authored deliverables.
- **Choose the principled course.** Decide from correctness, evidence, product boundaries, and durable consequences. Difficulty and duration determine how much investigation is needed, not which requirements can be weakened.
- **Evidence precedes correction.** Verify a suspected defect against its authored owner, source, observed output, and history before changing behavior. Report an inference as an inference and an unverified result as unverified.
- **Trace the consequence surface.** Follow a defect through actual parents, consumers, state changes, and boundary cases. Correct the earliest owner and every affected dependent within the requested scope.
- **Default over ask.** Choose and state a sensible default when the detail is delegated. Ask when a fork changes user-owned scope or authority.
- **Preserve instructions and work.** Keep direct instructions and their implementation trace through [Production-specific contract](.agents/skills/evidence-graph/work-specific.md). Preserve existing authored content and never silently discard another contributor's changes.

## Skills

Durable authoring procedures live under `.agents/skills/`. Read the applicable skill before acting, then read each conditional topic it routes to for the work at hand. Each pointer below mirrors that skill's scope; it does not replace the procedure.

### Contract

Before drafting or changing production work, read [Contract](.agents/skills/contract/SKILL.md), the declaration in [src/lint.config.ts](src/lint.config.ts), and the applicable contract documents. The declaration selects the production's actual obligations; this entry point does not replace those contracts.

- Shared contracts live under `docs/discovery`, `docs/naturalness`, `docs/upstream`, `docs/principles`, and `docs/obligations`. [Contract targets](.agents/skills/evidence-graph/contract-targets.md) owns each family's meaning and the boundaries between them.
- The creation-selected language contracts live under `docs/language`. Follow the same [contract-target procedure](.agents/skills/evidence-graph/contract-targets.md) to select construction or final-language duties for the active work.
- User instructions and production-specific rules enter through [Production-specific contract](.agents/skills/evidence-graph/work-specific.md). That procedure owns their authority, canonical placement, discovery record, and activation through `claims`; do not assume that shared contracts already cover every direct instruction.

Use [Evidence staging](.agents/skills/evidence-graph/staging.md) when declaring which hosts answer a contract, adding citations, or advancing a stage. Use [Production documents](docs/README.md) to locate an authored owner rather than treating contract files as production content.

### Production lifecycle

[Production lifecycle](.agents/skills/production-lifecycle/SKILL.md) owns shape selection, research, settings, pilots, treatments, scripts, screenplay construction, briefs, and final screenplay naturalness. Read it before selecting or changing a production shape or authoring those layers. Graph structure, TypeScript implementation, and rendered judgment belong to the separate skills below.

### Evidence graph

[Evidence graph](.agents/skills/evidence-graph/SKILL.md) owns the typed declaration in `src/lint.config.ts`, shared and local contract populations, claims, citations, exclusions, fingerprints, and stages. Read it before changing a governed contract, graph relationship, annotation, or stage. It does not own visual craft or frame observations beyond their declared evidence relationships.

### Source authoring

[Source authoring](.agents/skills/source-authoring/SKILL.md) owns deterministic TypeScript realization for maps, models, spaces, materials, instances, motions, systems, shots, and films. Read it before implementing geometry, rigs, motion, spatial design, staging, cameras, sound, or compilation. Narrative shape selection and rendered acceptance remain with their respective owners.

### Review verification

[Review verification](.agents/skills/review-verification/SKILL.md) owns Self-Review, evidence inspection, viewer observation, capture, measurements, and final acceptance. Read it before claiming a design or rendered result works and before closing, recording, or committing an authorship or stage boundary. A structural check does not substitute for viewing required frames.

## Maintenance

### Writing and ownership

Keep one semantic owner for every rule. This entry point owns production-wide attitude and skill routing; skills own procedures; contract documents own binding questions; authored documents own production decisions. Link to an owner instead of copying its procedure or completion condition. [Production documents](docs/README.md) maps the document populations.

Write instructions for both people and agents. Give each paragraph one job, preserve the context and failure boundaries needed to act correctly, and keep each prose paragraph on one source line. Use descriptive, unnumbered headings and plain language. Before accepting an instruction change, read its linked callers for missing links, contradictory rules, and duplicate ownership under [contract change and review](.agents/skills/evidence-graph/contract-targets.md#change-and-review).

### AGENTS.md

This is the shared entry point for Codex and Claude Code. Codex reads `AGENTS.md`; Claude Code follows `CLAUDE.md -> @AGENTS.md`. Keep its H2 sections to `Attitude`, `Skills`, and `Maintenance`, with global behavioral rules only in `Attitude`.

Update this entry point when a skill scope, route, or production-wide rule changes. [Static-document updates](README.md#static-document-updates) owns the installed files and their version control; [Project instructions](.agents/skills/production-lifecycle/index.md#project-instructions) owns loading this project's entry point while authoring.

### Skills

Keep skills at `.agents/skills/<kebab-name>/SKILL.md`. The YAML `name` matches the directory, and the third-person `description` states its trigger and exclusions. This file's corresponding pointer mirrors that scope more briefly; revise the skill's trigger first when its scope changes.

Keep shared procedure in `SKILL.md` and substantial conditional phases in directly linked sibling Markdown files. Do not add empty directories, unused helpers, or a second copy of a shared rule. The shipped set is `contract`, `production-lifecycle`, `evidence-graph`, `source-authoring`, and `review-verification`.
