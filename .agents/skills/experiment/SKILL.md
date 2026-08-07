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
pnpm run experimental <name>            # render experimental/<name> and install it
pnpm run experimental <name> --force    # render over an existing one
pnpm run experimental <name> --refresh  # repack and reinstall, keeping the production
```

The name must be one portable directory segment. `--no-install` renders without packing or installing, which is only useful for inspecting the output.

Creation packs every workspace package, so it runs each package's build and takes several minutes. A sandbox holds the tarballs it was created from, not a live view of the working tree, so **a change under `packages/` reaches it only when you pack again**.

Use `--refresh` for that once a production is under way. `--force` re-renders the scaffold, which writes the starter's design, screenplay, and source back over the film in progress; `--refresh` repacks, rewrites only the manifest's tarball pins, and reinstalls.

`experimental/` is gitignored. Delete a sandbox when its question is answered, and never commit anything from inside one.

## What The Generator Wires, And Why It Matters

Read this before debugging a sandbox that will not start. Each item is a failure someone already paid for.

| Wiring | Reason |
| --- | --- |
| `@automovie/*` install as `file:./.tarballs/*.tgz`, packed from the working tree | A tarball carries `publishConfig`, so `exports` resolve to built `lib/*.js` with typia's transform applied. The sandbox exercises the same resolution a real user's project does |
| The tarball filename carries a content digest | `file:` specifiers are keyed by path, so a rebuilt package under an unchanged version would leave a sandbox installed against stale bytes |
| All eight packages are pinned directly, `ingest` and `render` included | `pnpm pack` rewrites the packed packages' own `workspace:^` ranges into plain semver, which would otherwise resolve from the public registry at a version this monorepo never published |
| The install runs `npm`, not `pnpm` | npm satisfies those transitive ranges from the directly installed siblings. pnpm does not, and its `overrides` do not reach a range from inside a packed tarball either — the same 404 just surfaces one package later |
| A standalone install, not a root workspace member | A member writes an importer into the tracked `pnpm-lock.yaml`, and `experimental/` is gitignored, so that lock would name a directory no other checkout has |
| `.claude/settings.json` sets `enableAllProjectMcpServers` | A `.mcp.json` server starts unapproved, approval is interactive, and `--dangerously-skip-permissions` does not grant it, so a headless session would see no automovie tools at all |

Linking the packages directly was tried first and is not viable. A `link:` resolves through `exports` to untransformed `src/*.ts`, and the measured MCP host then took **133 seconds** to answer `initialize` against a client timeout of **60**, which no environment variable moves. `MCP_TIMEOUT` governs a different phase and is applied; the request itself still fails with `-32001`. Warming that compile is impossible too: `ttsx` writes its emitted output to a **PID-scoped** directory under `node_modules/.cache/ttsc/ttsx/project/`, so no later process reuses it, and a `ttsc` build beforehand changes nothing.

Two symptoms map straight to this table. `typia.llm.controller(): no transform has been configured` or `does not provide an export named` for a symbol the package plainly exports both mean something is resolving `src` rather than a tarball's `lib`. `Pending approval (run \`claude\` to approve)` from `claude mcp list` means the settings file did not reach the session.

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
