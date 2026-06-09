# Project Outline

## Product Contract

`autofilm` moves and forms characters and objects through LLM function calling / structured output, then validates and renders them deterministically. It is the cheap, controllable, reproducible alternative to diffusion image/video generators: a fixed asset performed by an LLM and rendered by a deterministic engine yields the frame-to-frame consistency diffusion cannot.

The endgame is to represent **all objects and all motion** — rigs, range-of-motion constraints, joint dependencies/drivers, cameras, lights, scenes, time — well enough to assemble a film from objects and motion alone. The early AI/function-calling schema may stay humble (a clothed character that walks, runs, dances), but **`interface` and `engine` are built to the final goal and must stay permanently extensible**: every future axis (new rig profile, finer detail layer, camera, prop, dynamics, timeline) is additive, never a rewrite. A bare imported 3D model has no constraints or dependencies; adding that semantic layer is what makes autofilm an engine rather than a model holder.

This is a long-haul mission. Work proceeds in small reviewable PRs, with the `.wiki/` revised as understanding changes and test coverage held at 100% throughout. The architecture is recorded in `.wiki/` (start at `.wiki/README.md`); decisions in `.wiki/07-decisions/`. `interia` (sibling project, interior spaces) shares autofilm's philosophy and conventions and forms one set with it long-term.

## Layout

- `packages/interface` (`@autofilm/interface`): the type hub — the AST the LLM emits against (geometry, skeleton/rig, pose, expression, motion, material, model, scene, validation). Depends on `typia` only; pure types, no runtime.
- `packages/engine` (`@autofilm/engine`): the deterministic engine — math, kinematics (FK), ROM and other constraint validators, motion sampling, tessellation. Pure TypeScript, no `three.js`.
- `packages/viewer` (`@autofilm/viewer`): the render/playback surface over `three.js` (the only package that imports `three`). A viewer, not an editor.
- Later packages (`agent`, `ingest`, `compiler`) are planned in the wiki, not yet built. `@agentica/core` (the LLM layer) will be imported only inside `agent`.
- `test/` (`@autofilm/test`): the `@nestia/e2e` `DynamicExecutor` program; one scenario per file under `test/src/features/<domain>/`, builders under `features/internal/`.
- `internals/config`: shared base `tsconfig.json` and `assertBuild.js`.
- `.wiki/` (gitignored): the working knowledge base — research, design, decisions, worklog. The first thing to read at session start.
- `.references/` (gitignored): downloaded reference materials (specs, example models, motion datasets) used during reference study.

## Commands

```bash
pnpm install                              # workspace install + ts-patch via prepare
pnpm run build                            # recursive tsc + assertBuild over packages
pnpm run format                           # prettier write
pnpm --filter @autofilm/test start          # run the test suite
pnpm --filter @autofilm/test coverage       # run tests under the c8 100% gate
```

Node 22 LTS, pnpm 10. CI: `.github/workflows/{build,test}.yml`.
