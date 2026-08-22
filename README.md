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
6. Design, source, asset, shot, sequence, optional rendition, and film reviews bind judgment to current evidence.
7. Rendering publishes only current, receipt-backed deliverables; read-only `verify` reopens those bytes, receipts, and reviews and rejects any mismatch.

This division keeps creative judgment with the user and coding agent while making technical claims reproducible and machine-verifiable.

## Product boundary

The coding agent owns `src`, `docs`, `test`, and `public`. It writes ordinary files and runs ordinary package commands. AutoMovie owns bounded design state, compiler output, review records, render receipts, and content-addressed delivery artifacts.

The MCP server is deliberately narrow. It exposes only the facts a normal coding channel cannot carry safely, and the table below is the whole surface:

| Tool               | Responsibility                                                           |
| ------------------ | ------------------------------------------------------------------------ |
| `getGuideDocument` | serve one packaged guide and record session read credit                  |
| `captureFrame`     | produce and receipt an actual shot or asset PNG through the host adapter |
| `repaintShot`      | optionally derive and receipt a structure-preserving visual rendition    |
| `prepareReview`    | derive the current evidence-bound review worksheet                       |
| `submitReview`     | validate and store a verdict-last review                                 |

MCP has no design setter, compiler, renderer, status query, geometry query, project switcher, or internal LLM. Package and scaffold commands provide those deterministic operations, while [`@automovie/engine`](./packages/engine) and [`@automovie/interface`](./packages/interface) remain directly importable for code-native work.

## Delivery modes

`visualDelivery: "deterministic"` ships compiler and renderer output directly. It is the default, zero-configuration path and does not depend on a diffusion service.

`visualDelivery: "repainted"` is an optional host-adapter lane. The deterministic shot remains technical truth; its completed review must precede repaint. The derived MP4 receives an immutable provenance receipt and a separate rendition review, and final sequence and film review cite the selected rendition. AutoMovie verifies those resident bytes and their provenance rather than claiming that a non-deterministic model can reproduce them.

## Start a production

```bash
npx create-automovie <dir>
cd <dir>
npm install
npm run capture:install
npm run capture:doctor
npm run build
npm test
npm run preview -- --shot opening --time 2 --pass beauty
npm run review:status
```

The generated README explains the complete tracked-authoring, compile, capture, review, render, and verification loop. Review-bound commands intentionally stop when evidence is missing or stale. The local viewer renders compiler-owned output; an arbitrary screenshot cannot satisfy a review.

## Packages

| Package                                                      | Purpose                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`@automovie/interface`](./packages/interface)               | Shared data contracts for authoring, production design, generated output, evidence, review, and delivery.                           |
| [`@automovie/engine`](./packages/engine)                     | Deterministic motion, geometry, physics, film-grammar, validation, and shot-realization engine.                                     |
| [`@automovie/evidence`](./packages/evidence)                 | Reusable film, brief, and library authoring evidence-graph construction and topology validation.                                   |
| [`@automovie/viewer`](./packages/viewer)                     | Three.js viewer for compiler-owned scenes, shots, films, review views, and imported models.                                         |
| [`@automovie/render`](./packages/render)                     | Render planning, deterministic frame evaluation, and video export helpers.                                                          |
| [`@automovie/ingest`](./packages/ingest)                     | Digest-bound glTF, GLB, and VRM inspection for registered external models.                                                          |
| [`@automovie/face`](./packages/face)                         | Parametric face, head, hair, and fitting geometry retained behind an explicit dormant boundary.                                     |
| [`@automovie/archetypes`](./packages/archetypes)             | Primitive model archetype catalogue: parameter schemas, bounds, and geometry builders behind one registry.                          |
| [`@automovie/mcp`](./packages/mcp)                           | Knowledge, host-evidence, optional repaint, and verdict-last review boundary.                                             |
| [`@automovie/cli`](./packages/cli)                           | Project scaffold, migration, verification, and transport-free access to current compiler-owned state.                               |
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
