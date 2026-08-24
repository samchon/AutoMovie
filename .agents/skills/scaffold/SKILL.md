---
name: scaffold
description: Defines how an automovie production is researched, authored, evidenced, implemented, and reviewed inside the scaffold, including mutually exclusive film, brief, and library shapes; the settings-to-screenplay ladder; model, space, material, instance, motion, and system branches; production-specific contracts; and generated-project guidance. Use before authoring or reviewing production content or editing packages/cli/scaffold, which every generated project inherits.
---

# Authoring a production

`packages/cli/scaffold` is the empty authoring harness `@automovie/cli` stamps out. A completed regression film fixture lives outside it so generated projects inherit capability and contracts, never another production's content. Treat every scaffold change as a generated-project API change.

Identify the selected `kind` and every layer stage in `lint.config.ts`. Read the production's `AGENTS.md`, all earlier active layers, every applicable shared target under `docs/discovery`, `docs/principles`, and `docs/obligations`, and every production-local target selected by an added claim before writing.

The scaffold has one documentation root. Reusable shared targets live in `docs/discovery`, `docs/principles`, and `docs/obligations`; production facts, research, designs, prose, and additional targets live in the other `docs` branches. Never put one production's fact in a shared target, put host-side evidence tags there, weaken a shared rule for one production, or create a local target without its corresponding additive claim. Keep that claim disabled with its host before evidence begins, then enable both together.

## Workflow documents

Read each applicable document in full before acting:

- [Production kinds](production-kinds.md) selects exactly one film, brief, or library shape.
- [Production-specific contract](work-specific.md) preserves direct instructions and classifies every adopted rule before bulk settings work.
- [Research](research.md) owns the optional external-evidence ledger and its downstream consumption.
- [Settings](settings.md) defines delivery, canon, capabilities, constraints, and shared conventions for every shape.
- [Design branches](design-branches.md) routes models, spaces, materials, instances, motions, and systems without overlap; it links the detailed model-and-motion procedure when those branches apply.
- [Storylines](storylines.md), [Scenarios](scenarios.md), and [Screenplays](screenplays.md) own the film-only refinement ladder.
- [Direct briefs](briefs.md) owns bounded audiovisual delivery that needs no independent narrative-refinement ladder.
- [Discovery, principles, and obligations](principles-and-obligations.md) governs reusable and production-local contract documents.
- [Evidence staging](evidence-staging.md) owns populations, tags, `draft -> evidence -> review`, diagnostics, and fingerprints.
- [Author process Self-Review](self-review.md) closes every complete production-specific contract, layer-authorship, evidence-repair, review-verification, and authorized stage-transition process before its author continues or hands it off.
- [Review](review.md) owns evidence review and final whole-production review.

The repository [evidence graph skill](../evidence-graph/SKILL.md) owns committed requirement-to-source traceability. This scaffold skill owns the separate generated-production graph. Apply the repository skill's citation honesty and diagnostic discipline without imposing its requirement-specification-source triangle here.

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

## Authored and derived source

Write production work in `docs`, `src`, `test`, and declared assets. Subject definitions are classes, recurring behavior is a named motion function, cross-subject choreography is a shot, production source serializes settings, and film source maps reviewed local shots and authored auxiliary tracks onto global time. Every governed source file contains its own named exported owner.

`.automovie/design`, `generated`, and `renders` are derived. A new scaffold contains no production records, and its generic emitter shell refuses until the author adds explicit imports and `emit` calls. Preserve that shell's setter, unchanged-record, and orphan-inventory checks. After authorship begins, correct source and regenerate. The screenplay index at `.automovie/design/<production>/screenplay/index.json` remains hand-authored because it resolves semantic coverage rather than duplicating derivable data.

`src/examples` demonstrates transferable techniques only. Production source does not import it or place it in an evidence population.

## Verification

After topology, contract, or citation changes, run the scaffold evidence gate. Falsify each new edge or refusal with a disposable negative probe, restore it, and require the normal graph to pass. Build and test the repository, generate a fresh scaffold from packed packages, and prove that its source lint and canaries pass while production design and compile refuse the unselected blank state. Compile the repository-only completed fixture to preserve production regression coverage. Measure every changed executable scaffold source at 100% statements, branches, functions, and lines. For render, pose, expression, geometry, material, or motion changes, also follow the applicable 3D-modeling and viewer-verification skills.
