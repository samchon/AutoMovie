---
name: project
description: Defines the automovie product contract, the long-haul mission, workspace layout, and canonical commands. Use when orienting in the repository, working inside any package, or choosing a build, test, format, or coverage command.
---

# Project Outline

## Product Contract

`automovie` moves and forms characters and objects through LLM function calling / structured output, then validates and renders them deterministically. It is the cheap, controllable, reproducible alternative to diffusion image/video generators: a fixed asset performed by an LLM and rendered by a deterministic engine yields the frame-to-frame consistency diffusion cannot.

The endgame is to represent **all objects and all motion** — rigs, range-of-motion constraints, joint dependencies/drivers, cameras, lights, scenes, time — well enough to assemble a film from objects and motion alone. The early AI/function-calling schema may stay humble (a clothed character that walks, runs, dances), but **`interface` and `engine` are built to the final goal and must stay permanently extensible**: every future axis (new rig profile, finer detail layer, camera, prop, dynamics, timeline) is additive, never a rewrite. A bare imported 3D model has no constraints or dependencies; adding that semantic layer is what makes automovie an engine rather than a model holder.

This is a long-haul mission. Work proceeds in small reviewable PRs, with the `.wiki/` revised as understanding changes and test coverage held at 100% throughout. The architecture is recorded in `.wiki/` (start at `.wiki/README.md`); decisions in `.wiki/07-decisions/`. `interia` (sibling project, interior spaces) shares automovie's philosophy and conventions and forms one set with it long-term.

## Layout

- `packages/interface` (`@automovie/interface`): the type hub — the AST the LLM emits against (geometry, skeleton/rig, pose, expression, motion, material, model, scene, validation). Depends on `typia` only; pure types, no runtime.
- `packages/engine` (`@automovie/engine`): the deterministic engine — math, kinematics (FK), ROM and other constraint validators, motion sampling, tessellation, the film pipeline (stage/block/perform/cut). Pure TypeScript, no `three.js`.
- `packages/forge` (`@automovie/forge`): parametric model building (head/body meshes, hair, morphs) from forge specs.
- `packages/ingest` (`@automovie/ingest`): glTF/model ingestion via `@gltf-transform/core`.
- `packages/viewer` (`@automovie/viewer`): the render/playback surface over `three.js` (the only package that imports `three`). A viewer, not an editor.
- `packages/playground`: Vite demo pages exercising the pipeline end to end; capture-verified via headless Chrome (see `.agents/skills/viewer-verification/SKILL.md`).
- `packages/mcp` (`@automovie/mcp`): the deterministic engine exposed as an MCP server — `AutoMovieApplication`'s methods (`stage`/`block`/`cut`/`forge`) become validated MCP tools via `typia.llm.controller` + `@typia/mcp`, for an external agent (Codex, Claude) to drive instead of an in-repo LLM workflow.
- `test/` (`@automovie/test`): the `@nestia/e2e` `DynamicExecutor` program; one scenario per file under `test/src/features/<domain>/`, builders under `features/internal/`.
- `internals/config`: shared base `tsconfig.json` and `assertBuild.js`.
- `.wiki/` (gitignored): the working knowledge base — research, design, decisions, worklog. The first thing to read at session start.
- `.references/` (gitignored): downloaded reference materials (specs, example models, motion datasets) used during reference study.

## Commands

```bash
pnpm install                              # workspace install (native TypeScript 7 / tsgo via ttsc)
pnpm run build                            # recursive ttsc + assertBuild over packages
pnpm run format                           # prettier write
pnpm --filter @automovie/test start          # run the test suite (ttsx, no separate compile step)
pnpm --filter @automovie/test coverage       # run tests under the c8 100% gate
```

Node 22 LTS, pnpm 10. CI: `.github/workflows/{build,test}.yml`.
