# AutoMovie

**An MCP server for deterministic motion-control video.**

AutoMovie is a Model Context Protocol server that lets an external agent create simple 3D scenes, move them correctly over time, and render long control videos that diffusion systems can use as guidance.

The output may look like stick figures, blocks, arrows, props, cameras, and rough stages. That is intentional. AutoMovie's job is not to be the final image. Its job is to provide the motion, staging, timing, depth, silhouettes, and camera path that a generative video pass can follow.

## The Bet

Diffusion video is good at appearance.

Extended structure is the weak point. Characters drift, bodies change, props disappear, camera intent decays, and long videos have to be stitched from shorter generations.

AutoMovie puts the structure outside the diffusion model.

Instead of asking a model to invent every frame from scratch, AutoMovie creates a deterministic guide video first:

- where each actor is,
- what each body is doing,
- where props move,
- when impacts happen,
- how the camera frames the scene,
- how long the scene lasts,
- what depth, masks, outlines, and pose hints should exist per frame.

Then a diffusion workflow can stylize that guide. The generative model paints over a stable performance instead of hallucinating the performance itself.

## What AutoMovie Is

AutoMovie is an MCP-driven motion generator and control-video engine.

It is designed for simple, code-made 3D objects:

- stick figures,
- block characters,
- primitive props,
- rough stages,
- simple lights,
- deterministic cameras.

Those objects can be animated for seconds, minutes, or hours because the source of truth is structured data and math, not a sampled video model. The rendered control video can then be split into shorter diffusion chunks while keeping the same underlying timeline.

The MCP surface is the product boundary: an agent asks for staged scenes, blocked movement, generated actors, cuts, validation, and renderable guide output; the deterministic engine computes and rejects invalid requests.

There are two ways to drive it, and both are first-class. **MCP** ([`@automovie/mcp`](./packages/mcp)) is the orchestration door: an agent works the pipeline over stdio, with slate state, transactions, and the guided correction loop. **Direct linking** is the code-native door: import [`@automovie/engine`](./packages/engine) and [`@automovie/interface`](./packages/interface) and program against the types themselves, injecting a custom synthesizer into `performShot`. Motion authoring is, at the limit, a coding activity, so a coding agent may reach for either; the `enact` action bridges them, letting a clip you compute in code flow through the same engine the MCP tools use. Scaffold a starter with `npx automovie start <dir>`.

## What AutoMovie Is Not

AutoMovie is not a character creator.

It is not trying to solve realistic human modeling, final-quality faces, hair, clothes, or production art. Those remain separate problems.

AutoMovie is also not a replacement for diffusion. It is the layer before diffusion: the low-cost deterministic rehearsal that tells diffusion what should happen.

## How It Works

AutoMovie uses structured scene and motion data instead of pixels as its first language.

An agent can describe a small stage: actors, props, poses, actions, camera moves, timing, and cuts. The engine validates the description, resolves the motion, and renders the result the same way every time.

If a pose asks an elbow or knee to move outside its allowed range, the engine rejects it with a concrete violation. If a prop is attached to a hand, the prop follows the computed hand frame. If an arrow is launched, its path is calculated as motion data, not painted frame by frame.

The important property is reproducibility. A long sequence can be regenerated, inspected, corrected, and used again as a control source.

## Why This Direction Works

The useful version is narrow:

1. Build only simple 3D objects in code.
2. Generate reliable long-form motion and camera control.
3. Render guide passes such as pose, depth, masks, outlines, and flat shaded video.
4. Let diffusion handle final visual style in shorter controlled chunks.

This keeps AutoMovie inside the part of the problem that code can do well.

## Current Status

The deterministic core is working.

AutoMovie already has a broad internal vocabulary for models, skeletons, poses, motion, expressions, scenes, cameras, cuts, validation, and playback. The engine can resolve poses, sample motion, enforce joint limits, move props, calculate projectiles, assemble shots, and render browser demos.

The project is early. The most important unfinished work is completing the MCP motion authoring surface, then exporting the right guide passes for diffusion workflows.

## Packages

| Package | Purpose |
|---|---|
| [`@automovie/interface`](./packages/interface) | Shared data shapes for scenes, models, skeletons, poses, motion, cameras, cuts, and validation. |
| [`@automovie/engine`](./packages/engine) | Deterministic math and motion engine: posing, kinematics, constraints, actions, physics, playback, and shot assembly. |
| [`@automovie/viewer`](./packages/viewer) | Three.js viewer for drawing engine output. It is a viewer, not an editor. |
| [`@automovie/render`](./packages/render) | Headless render planning, model export, and video export helpers. |
| [`@automovie/ingest`](./packages/ingest) | glTF/GLB ingestion into AutoMovie's core graph and clip data. |
| [`@automovie/forge`](./packages/forge) | Procedural model-building experiments kept for simple generated assets. |
| [`@automovie/mcp`](./packages/mcp) | MCP surface for external agents to drive parts of the deterministic motion engine. |
| [`@automovie/playground`](./packages/playground) | Browser demos for inspecting motion, props, cameras, and simple characters. |

## Next Work

The next useful version of AutoMovie should focus on:

- making the MCP tools cover the practical motion-generation loop,
- keeping generated models simple and robust,
- exporting diffusion-friendly guide passes,
- supporting long timelines through deterministic chunking,
- improving camera, staging, and action grammar,
- keeping visual demos verifiable in the browser.

Studio-grade character creation is not the active product surface.

## Try It

```bash
pnpm install
pnpm run build
pnpm run test
```

Requirements:

- Node.js 22 or newer
- pnpm 10

For browser demos:

```bash
pnpm --filter @automovie/playground dev
```

## License

[MIT](./LICENSE)
