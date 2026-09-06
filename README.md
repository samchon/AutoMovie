# AutoMovie

**Coding-agent-native deterministic filmmaking.**

AutoMovie lets a user scaffold a production repository and direct a coding agent in natural language. The agent writes screenplay prose, typed design records, TypeScript performances, tests, and assets. AutoMovie compiles and renders those tracked inputs deterministically, then binds visual review and delivery to the exact bytes that were produced.

The result is a cheap, controllable, and reproducible alternative to asking a diffusion model to invent an entire video. A fixed asset is performed by agent-authored code and rendered by a deterministic engine, so the same inputs produce the same motion, staging, timing, camera, and media.

## The contract

AutoMovie is built around one evidence chain:

1. Treatment and screenplay establish stable scenes and dramatic promises.
2. Typed production, world, model, formation, shot, and acceptance records state the machine-checkable contract.
3. Agent-owned TypeScript realizes shots with the same public engine that the compiler validates.
4. Compilation measures geometry, continuity, film grammar, physics advice, and source ownership instead of trusting echoed ids.
5. Project-owned capture binds actual pixels to compiler and runtime identity.
6. Written evidence binds judgment to what was actually seen: every claim that a unit is realized cites the requirement it answers and says what the captured frames showed.
7. Rendering publishes only current, receipt-backed deliverables; read-only `verify` reopens those bytes and receipts and rejects any mismatch.

This division keeps creative judgment with the user and coding agent while making technical claims reproducible and machine-verifiable.

## Product boundary

The coding agent owns `src`, `docs`, `test`, and `public`. It writes ordinary files and runs ordinary package commands. AutoMovie owns bounded design state, compiler output, render receipts, and content-addressed delivery artifacts.

There is no tool server between the agent and the project. A generated production ships the skill that teaches how to author it, the contracts its evidence graph cites, and its own npm scripts; the agent reads the skill, writes TypeScript, runs the scripts, and states in the source what the resulting frames showed. Nothing serves it a document, holds a verdict on its behalf, or accepts a review it did not write down.

That is the whole delivery mechanism, and it is deliberate. A capability an agent cannot reach by reading the project and running its scripts does not exist, which keeps the surface honest: [`@automovie/engine`](./packages/engine) and [`@automovie/interface`](./packages/interface) remain directly importable for code-native work, and there is no internal LLM anywhere in the repository.

## Delivery modes

`visualDelivery: "deterministic"` ships compiler and renderer output directly. It is the default, zero-configuration path and does not depend on a diffusion service.

`visualDelivery: "repainted"` is an optional host-adapter lane. The deterministic shot remains technical truth. The derived MP4 receives an immutable provenance receipt, and the evidence that a sequence or film is realized cites the selected rendition. AutoMovie verifies those resident bytes and their provenance rather than claiming that a non-deterministic model can reproduce them.

## Start a production

```bash
npx create-automovie <dir>
cd <dir>
npm install
npm run capture:install
npm run capture:doctor
npm run lint:source
npm run design
npm run compile
npm run preview -- --shot opening --time 2 --pass beauty
npm run lint -- --scope review
```

The generated [scaffold README](./packages/template/scaffold/README.md#canonical-command-routes) owns the complete command routes for tracked authoring, compilation, capture, review, rendering, migration, and verification. Review-bound commands intentionally stop when evidence is missing or stale. The local viewer renders compiler-owned output; an arbitrary screenshot cannot satisfy a review.

## Packages

| Package                                                      | Purpose                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`@automovie/interface`](./packages/interface)               | Shared data contracts for authoring, production design, generated output, evidence, review, and delivery.                           |
| [`@automovie/engine`](./packages/engine)                     | Deterministic motion, geometry, physics, film-grammar, validation, and shot-realization engine.                                     |
| [`@automovie/evidence`](./packages/evidence)                 | Reusable film, brief, and library authoring evidence-graph construction and topology validation.                                   |
| [`@automovie/viewer`](./packages/viewer)                     | Three.js viewer for compiler-owned scenes, shots, films, evidence views, and imported models.                                           |
| [`@automovie/render`](./packages/render)                     | Render planning, deterministic frame evaluation, and video export helpers.                                                          |
| [`@automovie/ingest`](./packages/ingest)                     | Digest-bound glTF, GLB, and VRM inspection for registered external models.                                                          |
| [`@automovie/face`](./packages/face)                         | Parametric face, head, hair, and fitting geometry retained behind an explicit dormant boundary.                                     |
| [`@automovie/archetypes`](./packages/archetypes)             | Primitive model archetype catalogue: parameter schemas, bounds, and geometry builders behind one registry.                          |
| [`@automovie/production`](./packages/production)             | Deterministic production library: the compiler, tracked project store, capture, inspection, and render job.                          |
| [`@automovie/template`](./packages/template)                 | The scaffold every production is created from, the shared contracts its evidence graph cites, and the library that renders both.     |
| [`automovie`](./packages/cli)                                | Project scaffold, migration, verification, and transport-free access to current compiler-owned state.                               |
| [`create-automovie`](./packages/create-automovie)            | Package-manager-native one-command project creator.                                                                                 |
| [`@automovie/playground`](./packages/playground)             | Browser demonstrations for inspecting deterministic models, motion, cameras, and imported assets.                                   |

## Repository development

```bash
pnpm install
pnpm run build
pnpm run test
```

Requirements:

- Node.js 22 or newer
- pnpm 10

Run the playground with:

```bash
pnpm --filter @automovie/playground dev
```

## License

[MIT](./LICENSE)
