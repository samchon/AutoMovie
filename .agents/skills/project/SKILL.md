---
name: project
description: Defines the automovie product contract, what the product deliberately does not do, the long-haul mission, workspace layout, and canonical commands. Use when orienting in the repository, working inside any package, choosing a build, test, format, or coverage command, or judging whether a proposed capability is in scope.
---

# Project Outline

## Product Contract

`automovie` moves and forms characters and objects through LLM function calling / structured output, then validates and renders them deterministically. It is the cheap, controllable, reproducible alternative to diffusion image/video generators: a fixed asset performed by an LLM and rendered by a deterministic engine yields the frame-to-frame consistency diffusion cannot.

**What comes out is a prototype, not a finished shot.** The render is a blocking pass: readable geometry, correct staging, correct motion, correct timing, reproducible frame to frame. A director watches it to judge whether the film works, and a diffusion lane repaints it when a finished look is wanted. Photorealism is not the bar, so a change that buys visual richness at the cost of determinism, authorability, or review cost is buying the wrong thing.

**A capability the authoring agent cannot drive is not a capability.** The ceiling is not what a renderer could draw, it is what an LLM can emit toward, because a surface nobody drives still costs documentation, tests and maintenance while producing nothing. That criterion settles every scope question below, and it already explains the repository's shape: rough types in `interface`, closed unions instead of construction kits, a formation as a count and a layout rather than two thousand records, figures and gait tables in `archetypes` rather than in `engine`.

The endgame is to represent **all objects and all motion** (rigs, range-of-motion constraints, joint dependencies/drivers, cameras, lights, scenes, time) well enough to assemble a film from objects and motion alone. The early AI/function-calling schema may stay humble (a clothed character that walks, runs, dances), but **`interface` and `engine` are built to the final goal and must stay permanently extensible**: every future axis (new rig profile, finer detail layer, camera, prop, dynamics, timeline) is additive, never a rewrite. A bare imported 3D model has no constraints or dependencies; adding that semantic layer is what makes automovie an engine rather than a model holder.

This is a long-haul mission. Work proceeds in small reviewable PRs, with the `.wiki/` revised as understanding changes and every source file a change touches left at 100% coverage (the development skill states the obligation and its per-change scope). Architecture and decisions belong in `.wiki/` (`.wiki/07-decisions/` for the decision log), which is local to a checkout and may be empty; write there as understanding accrues rather than expecting to find it. `interia` (sibling project, interior spaces) shares automovie's philosophy and conventions and forms one set with it long-term.

## Out of Scope

These are decided exclusions, not backlog. Each carries the condition that reopens it, and each belongs in the contract JSDoc of the type that comes closest, the way `IAutoMovieEnvironmentInstant` states that sun direction is an input and `IAutoMovieCameraIntent` states that depth of field belongs to the repaint lane. An unwritten decision is rediscovered as a gap every few months.

- **Detailed human likeness.** Faces, hair, detailed torsos and detailed animals stay out. A figure is a crude proxy carrying rich meaning: a stickman that stands, walks and gestures correctly, not one that looks like anyone. The reason is authorability rather than effort, since no current model drives fine facial or anatomical form reliably from natural language, and an engine carrying it would carry a surface nobody can steer. It reopens when an authoring agent can drive that form, which makes this deferred work and not refused work.
- **Ornate decoration.** Mouldings, cornices, carved ornament and decorative catalogues are content. What the repository may owe is the general geometry a customer needs to author one: non-convex profiles, sweeps, booleans, an external-model escape hatch.
- **Cutaways as delivered frames.** A section plane that removes a roof or a wall so a floor can be read in one image is an inspection control, never a field of an authored camera, and nothing fills the exposed cut. A shot is judged on the image it delivers, so a frame taken after a wall was removed is a diagram about the production rather than evidence about that image; admitting the plane into the delivery camera would additionally make acceptance depend on it (a required subject sliced in half could no longer count as read) and oblige `outline`, `mask` and `depth` to agree on one section. The capability itself is shipped for review (`IAutoMovieSectionPlane`, `classifyAutoMovieSectionPlaneBox` in `engine`, `applyAutoMovieSectionPlanes` in `viewer`). It reopens when a production must deliver a cutaway AS a shot, at which point the plane becomes an authored camera field, `realizeShotContract` must count a clipped-away subject as unreadable, and capping becomes real work because a hollow shell in a delivered frame is a defect.
- **Scene export.** No glTF, USD or Alembic export path. Without one, **the engine's ceiling is the work's ceiling**, because nothing downstream makes up the difference. That is the price of the choice rather than a defect, and it has to stay visible to whoever designs the next capability.

## Capability, Not Content

The product packages hold general capability. Named catalogue entries, furniture models, profile libraries and helpers that hand over finished content do not belong in `interface`, `engine`, `viewer`, `production` or the shipped scaffold. A customer agent authors its own assets in its own repository TypeScript, and extending the engine or renderer is justified when authoring an object is blocked or crippled (a missing geometric operation, a lost degree of freedom, a relationship nothing can express), not by the wish to hand someone a finished chair.

The urge to pre-build is usually a symptom. "We should ship furniture" almost always means "authoring furniture is too hard right now", and shipping the catalogue hides that gap instead of closing it.

Pre-built content also destroys a measurement. The subject-independence benchmark asks whether an agent can build a film from a subject the repository planted nothing for, so anything planted for a subject removes exactly what it measures.

An example that proves a capability lives in a test fixture or in `packages/archetypes`, the designated home for shipped archetypes. It does not live in `engine`, in `interface`, or in the scaffold every generated project inherits verbatim.

## Layout

- `packages/interface` (`@automovie/interface`): the type hub, the AST the LLM emits against (geometry, skeleton/rig, pose, expression, motion, material, model, scene, validation). Pure types with no runtime dependency; ranges and units live in field JSDoc, enforced by `engine` validators.
- `packages/engine` (`@automovie/engine`): the deterministic engine. Math, kinematics (FK), ROM and other constraint validators, motion sampling, tessellation, the film pipeline (stage/block/perform/cut). Pure TypeScript, no `three.js`.
- `packages/evidence` (`@automovie/evidence`): the reusable production-authoring evidence graph. It validates film, brief, and library topology and turns one generated project's stages plus additive claims into `@ttsc/evidence` configuration; one typed `lint.config.ts` owns and exports that complete project-local declaration, and every reusable target lives in the generated project's own scaffold-local `docs` inventory.
- `packages/face` (`@automovie/face`): dormant parametric face/head/hair geometry, retained for compatibility and frozen by the likeness exclusion above. Do not extend it. `forge` remains the engine stand-in authoring stage and is intentionally free as a future package name.
- `packages/archetypes` (`@automovie/archetypes`): the shipped model-archetype catalogue; parameter schemas, bounds, geometry builders and the declarative gait tables; behind one registry the compiler is handed rather than one it enumerates. A figure or a prop the engine happens to ship lives here and not in `engine`, so what a production performs stays the production's decision.
- `packages/ingest` (`@automovie/ingest`): glTF/model ingestion via `@gltf-transform/core`.
- `packages/viewer` (`@automovie/viewer`): the render/playback surface over `three.js`, and the only library package that imports `three`. A viewer, not an editor. `playground` imports it too, as the demo application that mounts the viewer rather than as a layer under it.
- `packages/render` (`@automovie/render`): the deterministic frame schedule and encode plan a render spec turns into, plus headless capture, guide passes, caption planning and sidecars, and chunked sequence rendering.
- `packages/cli` (`automovie`): the `automovie` binary that scaffolds and inspects a production repository. `packages/template/scaffold/` is the blank authoring harness it stamps out; completed regression productions live in repository-only fixtures (see the scaffold skill).
- `packages/create-automovie`: the one-command project creator, a thin front door onto the same scaffolder.
- `packages/playground`: Vite demo pages exercising the pipeline end to end; capture-verified via headless Chrome (see `.agents/skills/viewer-verification/SKILL.md`).
- `packages/production` (`@automovie/production`): the deterministic production library a generated project runs on : the compiler, the tracked project store, capture, inspection, and the render job. It answers a project's own scripts, not a network surface: the repository hosts no internal LLM and no tool server, and what an authoring agent knows comes from the shipped skill rather than from a call.
- `test/` (`@automovie/test`): the `@nestia/e2e` `DynamicExecutor` program; one scenario per file under `test/src/features/<domain>/`, builders under `features/internal/`, repository invariants under `test/src/integrity/`, and coverage orchestration under `test/src/coverage/`.
- `build/`: the two typed repository operations that materialize package tarballs and disposable experiments, `tgz.ts` and `experimental.ts`; it is not a catch-all for validation, tests, or package tooling, and there is no `internals/` directory.
- `config/` (`@automovie/config`): the workspace-wide base `tsconfig.json` and shared lint policy.
- `docs/` (`@automovie/docs`): product requirements and package-independent system specifications, checked as an evidence graph during the workspace build.
- `.wiki/` (gitignored): the working knowledge base (research, design, decisions, worklog). Local to a checkout and often empty; read what it holds at session start and write what it lacks.
- `.references/` (gitignored): downloaded reference materials (specs, example models, motion datasets) used during reference study.

## Commands

```bash
pnpm install                              # workspace install (native TypeScript 7 / tsgo via ttsc)
pnpm run build                            # docs evidence lint plus recursive package builds
pnpm run build:tgz                        # pack the working tree for generated consumers
pnpm run experimental <name>             # render and install one disposable sandbox
pnpm run format                           # prettier write
pnpm --filter @automovie/test start       # run the test suite (ttsx, no separate compile step)
pnpm --filter @automovie/test coverage    # run the suite and report c8 coverage
```

Node 22 LTS, pnpm 10. CI: `.github/workflows/{build,test}.yml`.
