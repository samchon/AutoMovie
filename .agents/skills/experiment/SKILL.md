---
name: experiment
description: Defines how automovie runs an ad-hoc experiment: creating a disposable source-linked sandbox under experimental/, driving its MCP surface with a live Claude Code or Codex session against working-tree code, and deciding what an observation is worth. Use when the user asks to try something out, drive the tools by hand, or see how a change behaves through a real agent; do not use for a scored benchmark corpus (see the benchmark-campaign skill), a render inspection of something already running (viewer-verification), or a repository-wide audit (issue-campaign).
---

# Experiment

An experiment answers one question by running the real thing. Create a disposable sandbox, drive it with a live agent, read what happens, and throw the sandbox away.

The sandbox consumes this working tree, not a release. That is the whole point: a change to `packages/mcp` or `packages/engine` is live in the next host start, so the agent-facing surface can be exercised before it ships rather than after.

An experiment produces an observation, not a score. It is deliberately cheaper than the [benchmark campaign](../benchmark-campaign/SKILL.md), which exists when the question needs a corpus, a rubric, attribution, and a durable ledger. Reach for that skill when the user wants to measure the pipeline; stay here when they want to see something work.

Read the [project](../project/SKILL.md) and [mcp](../mcp/SKILL.md) skills before driving the tools, and the [viewer-verification](../viewer-verification/SKILL.md) skill before claiming anything about a render.

## Create The Sandbox

```bash
pnpm run experimental <name>          # render experimental/<name> and install it
pnpm run experimental <name> --force  # render over an existing one
```

The name must be one portable directory segment. `--no-install` renders without installing, which is only useful for inspecting the output.

The first install takes about a minute because the sandbox is a standalone pnpm project. Later runs reuse the global store.

`experimental/` is gitignored. Delete a sandbox when its question is answered, and never commit anything from inside one.

## What The Generator Wires, And Why It Matters

Read this before debugging a sandbox that will not start. Each item is a failure someone already paid for.

| Wiring | Reason |
| --- | --- |
| `@automovie/*` resolve as `link:../../packages/<name>` | The link resolves through each package's `exports` to `src/*.ts`, so the sandbox reads working-tree source with no build |
| A standalone install, not a root workspace member | A member writes an importer into the tracked `pnpm-lock.yaml`, and `experimental/` is gitignored, so that lock would name a directory no other checkout has |
| Every TypeScript entry runs under `ttsx`, the host and the project's own scripts alike | `tsx` runs no transformer, so linked source dies on typia's compile-time transform; and it transpiles that source as CommonJS, so an ESM importer loses every `export * from` the linked package's index declares |
| The host reads `lint.host.config.ts`, which enables no rules | `ttsx` type-checks first and ttsc discovers `@ttsc/lint`, whose `automovie/screenplay-contract` rule fails on any unrealized screenplay. The project's own `npm run lint` still runs the full rule set |

Three symptoms map straight to this table. `typia.llm.controller(): no transform has been configured` means something launched the host through `tsx`. `does not provide an export named` for a symbol the linked package plainly exports means a script did. A wall of `automovie/screenplay-contract` errors means it used the project's tsconfig instead of `tsconfig.mcp.json`.

A sandbox script fails loudly but exits through a pipe, so `npm run <script> | tail` can print a plausible tail for a command that died. Read the exit code, not the tail.

## Drive It

Claude Code reads the sandbox's `.mcp.json`, so attaching is nothing more than starting there:

```bash
cd experimental/<name>
claude
```

Codex takes its MCP servers from its own configuration rather than `.mcp.json`. The generator prints the exact `codex mcp add` line for the sandbox it just created; use that, because it carries absolute paths Codex needs.

Give the agent a brief and let it work. The agent drives the tools; you observe and record. Do not narrate the tool calls on its behalf or perform them yourself, since the point is to see what the surface affords a model that has only the guides and the schemas.

Drive the agent turn by turn when you need to play the user across a longer session: `claude -p "<brief>" --session-id <uuid>`, then `claude -p "<next turn>" --resume <uuid>`. Codex resumes with `codex exec resume --last "<next turn>"`.

## Read The Result

Judge against what the experiment set out to answer, and say plainly when the run did not settle it.

- Separate what the engine accepted from what the render shows. A render that disagrees with the engine result is a viewer bug; one that agrees and still looks wrong is an engine or data bug. Verify anything visual through the viewer-verification skill rather than trusting a tool's success return.
- Reproduce before believing. The engine is deterministic and the driving model is not, so a single odd result is not yet a finding.
- Record a suspicion the run cannot settle as a hypothesis with the observation that would confirm it, rather than acting on it.

Never adjust the sandbox to make a result look better. A sandbox edited until it passes has stopped being evidence.

## When An Observation Becomes Work

An experiment is allowed to end with nothing but an answer. Publish an issue only when the observation survives fact-checking against the real code path, and follow the [issue-campaign skill's Self-Contained Issue Body](../issue-campaign/SKILL.md#self-contained-issue-body) contract when you do.

Attribute before publishing, using the [benchmark-campaign skill's triage categories](../benchmark-campaign/SKILL.md#score-and-triage): an engine defect, a missing schema axis, MCP-surface friction, and a guide gap are automovie's; a model-side failure against an adequate surface is not.

If the question turns out to need systematic measurement rather than one run, stop and say so. That is the benchmark campaign's job, and running it informally produces anecdotes that look like data.
