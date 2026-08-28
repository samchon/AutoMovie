---
name: production
description: Defines how this project's production is researched, authored, configured, evidenced, implemented, and reviewed, including the mutually exclusive film, brief, and library shapes, the settings-to-screenplay ladder, the model, space, material, instance, motion, and system branches, production-specific contracts, staging, self-review, and review. Use before authoring or reviewing any production document, design record, governed configuration, or source file.
---

# Authoring a production

You are authoring one production: this project. Read its `AGENTS.md`, its `lint.config.ts`, its `automovie.config.ts`, `docs/README.md`, every active upstream layer, and every shared or production-local target its claims select before writing anything.

Author a film in the order `settings -> treatments -> scripts -> screenplays -> shots -> filmSources`, a brief in the order `settings -> briefs -> shots -> filmSources`, and a library as settings plus each design and source branch it delivers. The workflow documents below own authorship; the discovery, principle, and obligation families published by `@automovie/template` own the questions each authored population answers; [Evidence staging](evidence-staging.md) owns claims, tags, stages, and fingerprints.

Apply this workflow without subject-matter exceptions. Historical, technical, mechanical, or heavily researched material still requires explicit production canon and the full lineage, evidence, staging, and review workflow. External knowledge never substitutes for an authored owner.

Write only what was requested. Do not create a placeholder file, heading, or stub, and do not invent production content without an explicit authorship request.

## External retrieval

Web search and page retrieval are available to you. Where a phase requires a search, that phase says so: [Settings](settings.md#research-and-revision) owns when externally checkable canon must be opened rather than written from memory, [Research](research.md) owns the optional durable source ledger, and the discovery targets own the boundary search each layer owes over the production's directives, subject, sources, and assets. Those routes can record a truthful negative: an unresolved status or one population-wide exclusion naming what the search examined. That is why they can require a search at all.

Elsewhere the means are yours to use as the production calls for them: checking a link before it enters a `Sources:` line, or reading the sources behind a contract item when its wording alone leaves what it asks unclear. No item outside those phases obliges you to search, and none accepts a search in place of what it does ask.

A source that blocks automated retrieval is blocked, not absent. Record the block instead of silently dropping the claim or lowering its precision. When direct support remains unavailable, follow `docs/principles/settings.md#source-support`: deliberately reduce precision or return the claim to unresolved rather than attaching a broad portal.

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
| Maps | Broad-world extent, coordinates, terrain, water, ecology, land use, settlement, transport, infrastructure, weather, time state, and site interfaces |
| Spaces | Site, building exterior/interior, room, zone, boundary, opening, circulation, and clear dimension |
| Materials | Construction, finish, texture scale, optical/physical response, surface binding, and state |
| Instances | Prototype membership, stable repeated identity, transforms, variation, tiers, and placement validity |
| Motions | Reusable deterministic state change over time and its neutral observations |
| Systems | Coupled lighting, environment, effects, simulation, sound, service, state, budget, and failure behavior |
| Treatments | Detailed narrative treatment and audience-facing development |
| Scripts | Executable physical progression and consequential exchange |
| Screenplays | Final visible, written, audible, silent, and render-timed audience contract |
| Brief | One bounded delivery/shot/observation hierarchy and falsifying observations |
| Production source | Mechanical serialization of reviewed settings |
| Design source | Implementation of one reviewed model, map, space, material, instance, motion, or system owner |
| Shot source | Local composition, camera, light, orchestration, and acceptance for one reviewed scene or brief shot |
| Film source | Global selection, source-time mapping, transitions, and auxiliary-track mapping |

Correct the earliest owner when a later layer exposes a defect, then propagate the consequence and renew affected reviews. A clean compiler never authorizes an invented relationship or a decision in the wrong layer.

## Workflow documents

Read each applicable document in full before acting:

- [Production kinds](production-kinds.md) selects exactly one film, brief, or library shape.
- [Vertical-slice pilot](pilot.md) proves one truthful film or library slice through its last owned realization layer at full contract strength, then resets the retained work into the complete population.
- [Production-specific contract](work-specific.md) preserves direct instructions and classifies every adopted rule before bulk settings work.
- [Production configuration](configuration.md) separates fixed harness wiring from authored delivery, appearance, dialogue, provenance, speaker, and live-simulation choices serialized in `automovie.config.ts`; read it before source authorship.
- [Research](research.md) owns the optional external-evidence ledger and its downstream consumption.
- [Settings](settings.md) defines delivery, canon, subjects, capabilities, constraints, and shared conventions for every shape.
- [Design branches](design-branches.md) routes models, spaces, materials, instances, motions, and systems without overlap; it links the detailed model-and-motion procedure when those branches apply.
- [Treatments](treatments.md), [Scripts](scripts.md), and [Screenplays](screenplays.md) own the film-only refinement ladder.
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
- [Spatial design](craft/spatial-design.md): plan and circulation, openings and daylight, proportion and scale, exterior/interior agreement, material reading, repeated populations, and the distinct judgments made from plan, section, elevation, perspective, and traversal.

## Writing and compiling source

- [Ownership](source/ownership.md): what the author writes, what the compiler owns, what the renderer owns, and why `derive:example` is an executable teaching specimen rather than a production gate.
- [TypeScript](source/typescript.md): deterministic source-module patterns and typed registration.
- [Composition](source/composition.md): how a production's source is arranged once its shots repeat, which is a program that emits shots rather than one module per shot.
- [Compilation](source/compilation.md): the design, source, and final scopes, and atomic publication.

## Seeing what you built

- [Repaint](configuration.md#repaint-adoption-and-request-population): reviewed generator adoption, per-shot appearance requests, receipt identity, and the deterministic structural-authority ceiling.
- [Offline measurements](evidence/measurements.md): current-state building reports and texture-scale census, including their honest empty-population boundaries and their use in design review sets.
- [Capture](evidence/capture.md): exact capture targets, passes, receipts, and refusal recovery.
- [Inspection](evidence/inspection.md): render-free descriptions of compiled elements, parts, instances, and spaces, which answer a structural question a frame only hints at.
- [Debugging](evidence/debugging.md): diagnostics-first correction across ownership, derived artifacts, compile, inspection, and render.

Capture writes actual PNGs. Open them, and let the evidence citation that claims a unit is realized say what you saw in them. A citation that names no observation is not a review, and no ledger records one for you.

## Subject canon precedes its use

Every subject a later layer stages, animates, voices, or observes has a settings owner before that layer uses it, including an unnamed extra, a crowd, a machine, and an institution. `obligations/settings.md#operative-subject-inventory` owns whether every operative subject is accounted for; in a film, `obligations/subjects.md` owns what each of those owners must actually settle.

A treatment, script, screenplay, or brief that introduces a new participant, or that turns one member of an established group into an individual actor, returns to settings and completes that subject's canon before continuing.

Backcast the literal cast after every downstream draft or revision. A subject that appeared during writing is a settings defect until settings owns it, not a script detail.

## Local working memory

Create and use this project's own `.wiki/` as ignored local memory for ideas, accumulated knowledge, source research, unresolved questions, and continuity aids. Organize its files freely.

Nothing in `.wiki` binds this production. Before relying on a fact, decision, or rule, promote it into its canonical owner under `docs`. Never stage or commit `.wiki`.

## Prove the ladder before expanding it

Use the compiler-visible [vertical-slice pilot](pilot.md) when one real film delivery group or one fresh library design/source branch can expose an expensive upstream defect before sibling authorship begins. The pilot narrows only a partition-owning population or the number of owners that exist yet. Settings, canon, the production promise, discovery, principles, obligations, lineage, source ownership, and review remain at full strength.

An optional `.wiki` trial is still the cheaper preflight. Take one treatment event as far as a shot sketch, or sketch one design through its source boundary, before any governed host exists. It can reveal a missing space, subject, exchange, interface, or observation, but the graph never reads it and it proves nothing. Promote every retained decision into its canonical owner, then run the governed pilot when its cost is justified.

## Recording work

Commit one authored document at a time. After each coherent creation or material revision, stage exactly that one path, pass `git diff --check` on the staged content, confirm the staged list holds only that path, and commit it.

Write the message about the production, not about the operation. Name what the document now establishes, changes, or repairs in the production's own terms, so the log reads as its history rather than a list of file events. `Author space 007` and `Repair the atrium source ledgers` say nothing a reader could not get from the diff stat; `Separate the atrium's declared cell from the occupied stair volume` and `Limit the service-door pivot before it enters the wall` say what changed. State the consequence when a change has one.

Never create an empty or partial commit, stage broadly, mix files you do not own, move part of a layer to the next stage, enter review with unresolved evidence diagnostics, or begin a downstream layer while a required build fails. A stage-transition commit records the complete coherent snapshot that [Evidence staging](evidence-staging.md) requires; a progress commit records work inside the current stage and never certifies a partial layer as complete.

Before committing text outside ASCII, decode every staged file as strict UTF-8 and reject the commit on a replacement character. That catches truncation but not substitution: a mangled accent or curly quote decodes cleanly as some other script's letter, so also reject any character outside the writing systems this production uses. A letter from an unrelated script sitting inside a word is the common form, and it survives every check that looks only at validity. Encoding damage raises no build error, so these two checks are the only ones that catch it.

## Verification

Run `npm run lint:source` while authoring source, `npm run lint -- --scope source` for the graph as it stands, and the full `npm run lint` review gate only when the production is meant to answer it. `npm run compile` is the only command that may update generated output.

Run `capture:install` and `capture:doctor` before the first preview or render. Draw a shot frame with `npm run preview`, and an asset's whole judged set with `npm run turntable`. Never claim a unit is realized without opening the current bundle frames and saying in its evidence citation what they showed.
