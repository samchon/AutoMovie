---
name: production
description: Defines how this project's production is researched, authored, evidenced, implemented, and reviewed, including the mutually exclusive film, brief, and library shapes, the settings-to-screenplay ladder, the model, space, material, instance, motion, and system branches, production-specific contracts, staging, self-review, and review. Use before authoring or reviewing any production document, design record, or governed source file.
---

# Authoring a production

You are authoring one production: this project. Read its `AGENTS.md`, its `lint.config.ts`, `docs/README.md`, every active upstream layer, and every shared or production-local target its claims select before writing anything.

Author a film in the order `settings -> storylines -> scenarios -> script -> shots -> filmSources`, a brief in the order `settings -> briefs -> shots -> filmSources`, and a library as settings plus each design and source branch it delivers. The workflow documents below own authorship; `docs/discovery`, `docs/principles`, and `docs/obligations` own the questions each authored population answers; [Evidence staging](evidence-staging.md) owns claims, tags, stages, and fingerprints.

Apply this workflow without subject-matter exceptions. Historical, technical, mechanical, or heavily researched material still requires explicit production canon and the full lineage, evidence, staging, and review workflow. External knowledge never substitutes for an authored owner.

Write only what was requested. Do not create a placeholder file, heading, or stub, and do not invent production content without an explicit authorship request.

## Forbidden

Choosing any of these means the approach is already wrong. Stop and repair the artifact instead.

- **No evidence written to clear a diagnostic.** A tag records a relationship that already holds. Writing one to make an error disappear leaves the defect and adds a false statement.
- **No placeholder standing in for work.** An empty or stub file, heading, or unit passes every structural check and is then counted as authored.
- **No symptom patching.** Repairing only the unit where a finding surfaced leaves the cause, and the same failure returns in its neighbors.
- **No weakening the harness.** Reducing a stage, narrowing a population, disabling a review, inventing a fingerprint, or excluding a target the production owes converts a real failure into a green build.

## Layer boundaries

| Owner | Decision |
| --- | --- |
| Research | External source identity, used portion, authority, uncertainty, and affected production decision |
| Settings | Production and world facts, delivery, identity, capability, constraint, access, units, and review conditions |
| Models | Deterministic fixed blocking representation and its neutral observations |
| Spaces | Site, building exterior/interior, room, zone, boundary, opening, circulation, and clear dimension |
| Materials | Construction, finish, texture scale, optical/physical response, surface binding, and state |
| Instances | Prototype membership, stable repeated identity, transforms, variation, tiers, and placement validity |
| Motions | Reusable deterministic state change over time and its neutral observations |
| Systems | Coupled lighting, environment, effects, simulation, sound, service, state, budget, and failure behavior |
| Storylines | Detailed narrative treatment and audience-facing development |
| Scenarios | Executable physical progression and consequential exchange |
| Screenplay | Final visible, written, audible, silent, and render-timed audience contract |
| Brief | One bounded delivery/shot/observation hierarchy and falsifying observations |
| Production source | Mechanical serialization of reviewed settings |
| Design source | Implementation of one reviewed model, space, material, instance, motion, or system owner |
| Shot source | Local composition, camera, light, orchestration, and acceptance for one reviewed scene or brief shot |
| Film source | Global selection, source-time mapping, transitions, and auxiliary-track mapping |

Correct the earliest owner when a later layer exposes a defect, then propagate the consequence and renew affected reviews. A clean compiler never authorizes an invented relationship or a decision in the wrong layer.

## Workflow documents

Read each applicable document in full before acting:

- [Production kinds](production-kinds.md) selects exactly one film, brief, or library shape.
- [Production-specific contract](work-specific.md) preserves direct instructions and classifies every adopted rule before bulk settings work.
- [Research](research.md) owns the optional external-evidence ledger and its downstream consumption.
- [Settings](settings.md) defines delivery, canon, subjects, capabilities, constraints, and shared conventions for every shape.
- [Design branches](design-branches.md) routes models, spaces, materials, instances, motions, and systems without overlap; it links the detailed model-and-motion procedure when those branches apply.
- [Storylines](storylines.md), [Scenarios](scenarios.md), and [Screenplays](screenplays.md) own the film-only refinement ladder.
- [Direct briefs](briefs.md) owns bounded audiovisual delivery that needs no independent narrative-refinement ladder.
- [Contract targets](contract-targets.md) governs the shared discovery, principle, and obligation families and their production-local counterparts.
- [Evidence staging](evidence-staging.md) owns populations, tags, `draft -> evidence -> review`, diagnostics, and fingerprints.
- [Author process Self-Review](self-review.md) closes every complete contract, authorship, evidence-repair, review-verification, and stage-transition process before its author continues or hands it off.
- [Review](review.md) owns evidence review and final whole-production review.

## Craft the contracts do not decide

The documents above say what a unit must contain and when it may advance. These say how to make it good, and they are read when the work reaches them rather than as a set.

- [Cinematography](craft/cinematography.md): shot size, the 180-degree line, eyeline, screen direction, camera motion, and the deliberate violation.
- [Editing](craft/editing.md): the edit list, coverage, rhythm, transitions, and the priority order a cut is judged by.
- [Motion](craft/motion.md): action verbs, clip construction, contact, weight, expression, and continuity.
- [Sound](craft/sound.md): event-derived sound, dialogue, ambience, spatialization, and mix hierarchy.
- [Rigging](craft/rigging.md): silhouette-first object design, axes, pivots, skeletons, profiles, and the operable openings a building owns.

## Writing and compiling source

- [Ownership](source/ownership.md): what the author writes, what the compiler owns, and what the renderer owns.
- [TypeScript](source/typescript.md): deterministic source-module patterns and typed registration.
- [Composition](source/composition.md): how a production's source is arranged once its shots repeat, which is a program that emits shots rather than one module per shot.
- [Compilation](source/compilation.md): the design, source, and final scopes, and atomic publication.

## Seeing what you built

- [Capture](evidence/capture.md): exact capture targets, passes, receipts, and refusal recovery.
- [Inspection](evidence/inspection.md): render-free descriptions of compiled elements, parts, instances, and spaces, which answer a structural question a frame only hints at.
- [Debugging](evidence/debugging.md): diagnostics-first correction across ownership, derived artifacts, compile, inspection, and render.

Capture writes actual PNGs. Open them, and let the evidence citation that claims a unit is realized say what you saw in them. A citation that names no observation is not a review, and no ledger records one for you.

## Subject canon precedes its use

Every subject a later layer stages, animates, voices, or observes has a settings owner before that layer uses it, including an unnamed extra, a crowd, a machine, and an institution. `obligations/settings.md#operative-subject-inventory` owns whether every operative subject is accounted for; in a film, `obligations/subjects.md` owns what each of those owners must actually settle.

A storyline, scenario, screenplay, or brief that introduces a new participant, or that turns one member of an established group into an individual actor, returns to settings and completes that subject's canon before continuing.

Backcast the literal cast after every downstream draft or revision. A subject that appeared during writing is a settings defect until settings owns it, not a scenario detail.

## Local working memory

Create and use this project's own `.wiki/` as ignored local memory for ideas, accumulated knowledge, source research, unresolved questions, and continuity aids. Organize its files freely.

Nothing in `.wiki` binds this production. Before relying on a fact, decision, or rule, promote it into its canonical owner under `docs`. Never stage or commit `.wiki`.

## Prove the ladder on one unit before writing the whole layer

A stage applies to a whole layer, and a stage never moves backwards. There is no scoped pilot mode: once `storylines` is in `review`, every storyline file added afterwards owes complete evidence and current fingerprints immediately. Plan for that instead of discovering it after the complete treatment is written.

So prove the ladder before you commit the population. While the first layer is still in `draft`, take its first sequence forward in `.wiki`: stage that treatment as a throwaway scenario pass, and carry one beat as far as a shot sketch. Nothing in `.wiki` binds the production, and nothing about it touches a stage.

What that costs is one file. What it finds is the defect class that only appears under refinement: a treatment beat that no space admits, a subject with no canon, a scene whose decisive exchange was never written, a unit count the shot budget cannot carry. Repair those in settings and in the treatment while the layer is still `draft` and the repair is free.

The trial narrows what is drafted, not what the production promises. Settings stay scoped to the complete declared delivery, and every obligation, discovery duty, and review that binds the complete production binds the trial unit at full strength while you read it.

## Recording work

Commit one authored document at a time. After each coherent creation or material revision, stage exactly that one path, pass `git diff --check` on the staged content, confirm the staged list holds only that path, and commit it with a message about that document.

Never create an empty or partial commit, stage broadly, mix files you do not own, move part of a layer to the next stage, enter review with unresolved evidence diagnostics, or begin a downstream layer while a required build fails. A stage-transition commit records the complete coherent snapshot that [Evidence staging](evidence-staging.md) requires; a progress commit records work inside the current stage and never certifies a partial layer as complete.

Before committing text outside ASCII, decode every staged file as strict UTF-8 and reject the commit on a replacement character or other encoding damage. Encoding loss raises no build error, so this check is the only one that catches it.

## Verification

Run `npm run lint:source` while authoring source, `npm run lint -- --scope source` for the graph as it stands, and the full `npm run lint` review gate only when the production is meant to answer it. `npm run compile` is the only command that may update generated output.

Read `AUTOMOVIE_OVERALL` through the project's MCP server first, then the exact guide a tool or record requires. Use MCP for current frame evidence and evidence-bound review, and run `capture:install` and `capture:doctor` before the first preview or render. Never mark a visual review complete without opening the current bundle frames.
