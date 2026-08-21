---
name: scaffold
description: Defines how an automovie production is authored inside the scaffold, including its mutually exclusive film, brief, and library shapes; reusable principles and obligations; production-specific prose, model, motion, production, shot, and film-source evidence; staged review; research; and generated-project guidance. Use before authoring or reviewing production content, or editing packages/cli/scaffold, which every generated project inherits.
---

# Authoring a production

`packages/cli/scaffold/` is both the template `@automovie/cli` stamps out and a working production. Treat it as a public API: a change lands in every generated project.

Read the generated project's `AGENTS.md` first. Read the [evidence graph skill](../evidence-graph/SKILL.md) for repository requirement-to-source traceability. The production graph described here is separate and this skill owns its topology.

Before changing a production, read the topic documents that apply:

- Read [Production kinds](production-kinds.md) before selecting or changing a production shape.
- Read [Principles and obligations](principles-and-obligations.md) before editing `config/docs` or changing a principle population.
- Read [Evidence staging](evidence-staging.md) before activating, reviewing, or removing a layer.
- Read [Models and motions](models-and-motions.md) before changing a model, geometry, rig, motion, or their source implementation.
- Read [Review](review.md) before reviewing any production evidence or writing an `@evidenceReview`.

## Two document roots

The scaffold deliberately has two document roots.

- `config/docs/` is reusable production law. Its principles define one concern each; authored-document principles are per-file checklists, source principles are covered by their selected export populations, and obligations allocate responsibility across a document population. Generated productions inherit and may deliberately customize it.
- `docs/` is evidence about one production. It states its researched facts, canon, model decisions, motion decisions, narrative refinements, or bounded brief.

Never put a production fact in `config/docs`, and never weaken a reusable rule merely because one production cannot satisfy it. Select the right production kind or write a justified population exclusion where the rule permits one.

## Evidence topology

Each active rung answers for its direct parent and the reusable contracts that govern it. A parent must already be in `review` before a child activates; once the child itself enters `review`, every acknowledgement also carries a current fingerprint. Exact refinements are bijective at the authored unit shown below.

| Layer | Host | Direct evidence |
| --- | --- | --- |
| Research | `docs/research/*.md` | common/research principles; every active H2 is consumed by a downstream authored H2 once one exists |
| Settings | `docs/settings/*.md` | common/settings principles and settings obligations |
| Production source | exported production properties in `src/production.ts` | settings plus production-source principles |
| Models | `docs/models/*.md` | settings, common/model principles, model obligations |
| Motions | `docs/motions/*.md` | models and settings, common/motion principles, motion obligations |
| Storylines | `docs/storylines/*.md` | settings, narrative/storyline principles, and storyline obligations |
| Scenarios | `docs/scenarios/*.md` | exactly one storyline unit, settings, narrative/scenario principles |
| Script | `docs/script/*.md` | exactly one scenario unit, its storyline, settings, narrative/script principles |
| Briefs | `docs/briefs/*.md` | settings, any active model or motion branches, and common/brief principles |
| Model source | model classes under `src` | exactly one model document plus model-source principles |
| Motion source | exported motion functions and properties under `src/motions` | exactly one motion document plus motion-source principles |
| Shots | exported shot and acceptance symbols under `src/shots` | exactly one script scene or brief shot plus shot principles |
| Film source | exported film property in `src/film.ts` | every script sequence or brief delivery plus film-source principles |

For a film, narrative identity is an explicitly anchored `##` sequence, `###` scene, and `####` beat repeated in the same order and nesting through storyline, scenario, and script. The factory compares those physical identities as well as the citations, and a shot cites one script `###` scene. For a brief, an explicitly anchored `##` delivery, `###` shot, and `####` observation structure goes directly from brief to shots without borrowing narrative semantics. Do not cite whole files when an exact authored unit exists.

Research is an optional upstream branch. It may be drafted alone, but once any production layer is active, active research must be reviewed first and every research H2 must support at least one downstream authored H2. A downstream unit cites only the research it actually consumes; the population collectively prevents ledger entries with no production consequence.

## Authored source

Write the production in `docs`, `src`, `test`, and declared assets. Subject definitions are classes; recurring behavior is a named motion function; cross-subject choreography is a shot; production source serializes settings; film source maps reviewed shots and auxiliary tracks onto global time. Every governed source file contains its own named exported owner, so an otherwise invisible helper belongs outside those populations. Counts, layouts, envelopes, and procedural construction remain code rather than expanded records.

`.automovie/design`, `generated`, and `renders` are derived. Correct the authored source and regenerate them. The screenplay index at `.automovie/design/<production>/screenplay/index.json` is hand-authored and separately resolves every named beat and scene against the referenced Markdown, so moving prose also requires updating that index.

`src/examples` teaches transferable techniques only. Nothing may import it, and it remains outside the production evidence populations. Add a technique, not finished production content.

## Verification

Run the scaffold evidence gate after every topology or citation change. Falsify each new edge by removing one representative citation and confirming the intended diagnostic appears before restoring it. Build and test the repository, generate a fresh scaffold, and compile that generated production. If render, pose, expression, or motion changed, also follow the viewer-verification skill.
