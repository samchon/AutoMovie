# AutoMovie

**Coding-agent-native deterministic filmmaking.**

AutoMovie lets a user scaffold a production repository and direct a coding agent in natural language. The agent writes settings, treatments, scene scripts, construction and final screenplays, typed design values, TypeScript performances, tests, and assets. AutoMovie validates and renders those inputs deterministically; the project's review records identify the source revision and outputs actually inspected.

The result is a cheap, controllable, and reproducible alternative to asking a diffusion model to invent an entire video. A fixed asset is performed by agent-authored code and rendered by a deterministic engine, so the same inputs produce the same motion, staging, timing, camera, and media.

See it at [samchon.github.io/AutoMovie](https://samchon.github.io/AutoMovie/): the [medieval baron manor](https://samchon.github.io/AutoMovie/manor/), a finished production kept in this repository under [`experimental/medieval-baron-manor`](./experimental/medieval-baron-manor), is generated from its authored source in your browser.

## The contract

AutoMovie is built around one evidence chain:

1. Settings, treatments, and scripts establish mechanically precise canon, physical state changes, and executable scene action; construction screenplays fix the exact audiovisual realization, while a separate naturalness pass revises only dialogue, narration, and audience-read language.
2. Typed production, world, model, formation, shot, and acceptance records state the machine-checkable contract.
3. Agent-owned TypeScript realizes shots with the same public engine that the compiler validates.
4. Compilation measures geometry, continuity, film grammar, physics advice, and source ownership instead of trusting echoed ids.
5. Project-owned capture binds actual pixels to compiler and runtime identity.
6. Written evidence binds judgment to what was actually seen: every claim that a unit is realized cites the requirement it answers and says what the captured frames showed.
7. Delivery uses the reviewed source and outputs. The project authors the execution and verification its requested output needs through the public package APIs.

This division keeps creative judgment with the user and coding agent while making technical claims reproducible and machine-verifiable.

## Product boundary

The coding agent owns the production's source, documents, and assets. All production source, including tests and viewing or rendering entry points, belongs under `src`; `public` holds HTML and static assets. The scaffold's [ownership contract](./packages/template/scaffold/README.md#ownership) defines the file and typed-input boundary. No generated project-state store is installed.

There is no authoring tool server between the agent and the project. A generated production ships its authoring skills, local contracts, and source lint; the agent reads them, writes TypeScript, runs its own implementation, and records what the resulting frames showed. Optional read-only Markdown navigation does not author the production or judge its evidence.

That is the whole delivery mechanism, and it is deliberate. A capability an agent cannot reach by reading the project and running its scripts does not exist, which keeps the surface honest: [`@automovie/engine`](./packages/engine) and [`@automovie/interface`](./packages/interface) remain directly importable for code-native work, and there is no internal LLM anywhere in the repository.

## Delivery modes

`visualDelivery: "deterministic"` ships compiler and renderer output directly. It is the default, zero-configuration path and does not depend on a diffusion service.

`visualDelivery: "repainted"` is an optional host-adapter lane. The deterministic shot remains technical truth. The derived MP4 receives an immutable provenance receipt, and the evidence that a sequence or film is realized cites the selected rendition. AutoMovie verifies those resident bytes and their provenance rather than claiming that a non-deterministic model can reproduce them.

## Start a production

```bash
npx create-automovie <dir> --language korean
cd <dir>
npm install
npm run lint
```

Choose `chinese`, `english`, `japanese`, or `korean` explicitly. The scaffold starts without a production kind or authored content. Follow its installed `AGENTS.md` to select a kind and author the required documents and source. Installation is one-way; the project's tracked files remain its own after package upgrades.

The [scaffold README](./packages/template/scaffold/README.md#canonical-command-routes) owns the installed command inventory. The coding agent adds viewing, capture, or rendering source only when the requested production needs it; no preview stub or prewritten production command is installed. Its [authoring routes](./packages/template/scaffold/README.md#authoring-routes) lead to the evidence and review procedures.

## Packages

| Package                                                      | Purpose                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`@automovie/interface`](./packages/interface)               | Shared data contracts for authoring, production design, generated output, evidence, review, and delivery.                           |
| [`@automovie/engine`](./packages/engine)                     | Deterministic motion, geometry, physics, film-grammar, validation, and shot-realization engine.                                     |
| [`@automovie/evidence`](./packages/evidence)                 | Reusable film, brief, and library authoring evidence-graph construction and topology validation.                                   |
| [`@automovie/viewer`](./packages/viewer)                     | Three.js viewer for compiler-owned scenes, shots, films, evidence views, and imported models.                                           |
| [`@automovie/render`](./packages/render)                     | Render planning, deterministic frame evaluation, and video export helpers.                                                          |
| [`@automovie/ingest`](./packages/ingest)                     | Digest-bound glTF, GLB, and VRM inspection for registered external models.                                                          |
| [`@automovie/human`](./packages/human)                       | Procedural facial anatomy, identity and expression documents, numerical editor state, and static facial-asset export.                |
| [`@automovie/archetypes`](./packages/archetypes)             | Primitive model archetype catalogue: parameter schemas, bounds, and geometry builders behind one registry.                          |
| [`@automovie/production`](./packages/production)             | Deterministic production library: the compiler, tracked project store, capture, inspection, and render job.                          |
| [`@automovie/template`](./packages/template)                 | The scaffold every production is created from, the shared contracts its evidence graph cites, and the library that renders both.     |
| [`automovie`](./packages/cli)                                | One-way project creation, Markdown TOC maintenance, external-asset inspection, and capability routes.                               |
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

Run the website with:

```bash
pnpm --filter @automovie/website dev
```

`website/` is the static site published to GitHub Pages by `.github/workflows/website.yml` on every push to `master`; `pnpm --filter @automovie/website deploy` publishes a build from the current checkout by hand.

## License

[MIT](./LICENSE)
