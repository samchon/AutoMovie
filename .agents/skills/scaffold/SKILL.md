---
name: scaffold
description: Defines how an automovie production is researched, authored, evidenced, implemented, and reviewed inside the scaffold, including mutually exclusive film, brief, and library shapes; the settings-to-screenplay ladder; model and motion branches; production-specific contracts; and generated-project guidance. Use before authoring or reviewing production content or editing packages/cli/scaffold, which every generated project inherits.
---

# Authoring a production

`packages/cli/scaffold` is both the template `@automovie/cli` stamps out and a working production. Treat every change as a generated-project API change.

Identify the selected `kind` and every layer stage in `lint.config.ts`. Read the production's `AGENTS.md`, all earlier active layers, the shared contracts under `config/docs`, and every production-local target selected by an added claim before writing.

Reusable production law lives in `config/docs`. Production-specific facts, research, designs, prose, and additional targets live in `docs`. Never put one production's fact in reusable law, weaken a shared rule for one production, or create a production-local target without an active additive claim.

## Workflow documents

Read each applicable document in full before acting:

- [Production kinds](production-kinds.md) selects exactly one film, brief, or library shape.
- [Production-specific contract](work-specific.md) preserves direct instructions and classifies every adopted rule before bulk settings work.
- [Research](research.md) owns the optional external-evidence ledger and its downstream consumption.
- [Settings](settings.md) defines delivery, canon, capabilities, constraints, and shared conventions for every shape.
- [Models and motions](models-and-motions.md) defines deterministic representation and reusable change over time.
- [Storylines](storylines.md), [Scenarios](scenarios.md), and [Screenplays](screenplays.md) own the film-only refinement ladder.
- [Direct briefs](briefs.md) owns bounded non-narrative audiovisual delivery.
- [Principles and obligations](principles-and-obligations.md) governs reusable and production-local contract documents.
- [Evidence staging](evidence-staging.md) owns populations, tags, `draft -> evidence -> review`, diagnostics, and fingerprints.
- [Review](review.md) owns evidence review and final whole-production review.

The repository [evidence graph skill](../evidence-graph/SKILL.md) owns committed requirement-to-source traceability. This scaffold skill owns the separate generated-production graph. Apply the repository skill's citation honesty and diagnostic discipline without imposing its requirement-specification-source triangle here.

## Layer boundaries

| Owner | Decision |
| --- | --- |
| Research | External source identity, used portion, authority, uncertainty, and affected production decision |
| Settings | Production and world facts, delivery, identity, capability, constraint, access, units, and review conditions |
| Models | Deterministic fixed blocking representation and its neutral observations |
| Motions | Reusable deterministic state change over time and its neutral observations |
| Storylines | Detailed narrative treatment and audience-facing development |
| Scenarios | Executable physical progression and consequential exchange |
| Screenplay | Final visible, written, audible, silent, and render-timed audience contract |
| Brief | One bounded non-narrative delivery and falsifying observations |
| Production source | Mechanical serialization of reviewed settings |
| Model and motion source | Implementation of one reviewed design owner |
| Shot source | Local composition, camera, light, orchestration, and acceptance for one reviewed scene or brief shot |
| Film source | Global selection, source-time mapping, transitions, and auxiliary-track mapping |

Correct the earliest owner when a later layer exposes a defect, then propagate the consequence and renew affected reviews. A clean compiler never authorizes an invented relationship or a decision in the wrong layer.

## Authored and derived source

Write production work in `docs`, `src`, `test`, and declared assets. Subject definitions are classes, recurring behavior is a named motion function, cross-subject choreography is a shot, production source serializes settings, and film source maps reviewed local shots and authored auxiliary tracks onto global time. Every governed source file contains its own named exported owner.

`.automovie/design`, `generated`, and `renders` are derived. Correct authored source and regenerate them. The screenplay index at `.automovie/design/<production>/screenplay/index.json` is hand-authored and resolves every scene and beat against Markdown, so an identity or wording change updates the index and all dependants.

`src/examples` demonstrates transferable techniques only. Production source does not import it or place it in an evidence population.

## Verification

After topology, contract, or citation changes, run the scaffold evidence gate. Falsify each new edge or refusal with a disposable negative probe, restore it, and require the normal graph to pass. Build and test the repository, generate a fresh scaffold from packed packages, and run that consumer's source lint, tests, design regeneration, and compile. Measure every changed executable scaffold source at 100% statements, branches, functions, and lines. For render, pose, expression, geometry, material, or motion changes, also follow the applicable 3D-modeling and viewer-verification skills.
