---
name: experiment
description: Defines how automovie runs an ad-hoc experiment: creating a disposable source-linked sandbox under experimental/, briefing and steering a live Claude Code or Codex session that authors inside it against working-tree code, and deciding what an observation is worth. Use when the user asks to try something out, drive a generated project by hand, run a benchmark against an authoring agent, or see how a change behaves through a real agent; do not use for a render inspection of something already running (viewer-verification) or a repository-wide audit (issue-campaign).
---

# Experiment

An experiment answers one question by running the real thing. Create a disposable sandbox, drive it with a live agent, read what happens, and throw the sandbox away.

The sandbox consumes this working tree, not a release. That is the whole point: a change to `packages/production` or `packages/engine` is live in the sandbox's next script run, so the agent-facing surface can be exercised before it ships rather than after.

An experiment produces an observation, not a score.

Read the [project](../project/SKILL.md) and [scaffold](../scaffold/SKILL.md) skills before driving a sandbox, and the [viewer-verification](../viewer-verification/SKILL.md) skill before claiming anything about a render.

## Create The Sandbox

The typed repository implementation is `build/experimental.ts`, and its package materialization boundary is `build/tgz.ts`.

```bash
pnpm run experimental <name>            # render experimental/<name> and install it
pnpm run experimental <name> --force    # render over an existing one
pnpm run experimental <name> --refresh  # repack and reinstall, keeping the production
```

The name must be one portable directory segment. `--no-install` renders without packing or installing, which is only useful for inspecting the output.

Creation packs every workspace package, so it runs each package's build and takes several minutes. A sandbox holds the tarballs it was created from, not a live view of the working tree, so **a change under `packages/` reaches it only when you pack again**.

Use `--refresh` for that once a production is under way. `--force` re-renders the blank scaffold and can overwrite user-authored scaffold-managed files such as `lint.config.ts`, guides, scripts, viewer files, and package wiring; `--refresh` repacks, rewrites only the manifest's tarball pins, and reinstalls without replacing production content.

`experimental/` is gitignored. Delete a sandbox when its question is answered, and never commit anything from inside one.

## What The Generator Wires, And Why It Matters

Read this before debugging a sandbox that will not start. Each item is a failure someone already paid for.

| Wiring | Reason |
| --- | --- |
| `@automovie/*` install as `file:./.tarballs/*.tgz`, packed from the working tree | A tarball carries `publishConfig`, so `exports` resolve to built `lib/*.js` with typia's transform applied. The sandbox exercises the same resolution a real user's project does |
| The tarball filename carries a content digest | `file:` specifiers are keyed by path, so a rebuilt package under an unchanged version would leave a sandbox installed against stale bytes |
| Every packed package is pinned directly, `evidence`, `ingest`, and `render` included | `pnpm pack` rewrites the packed packages' own `workspace:^` ranges into plain semver, which would otherwise resolve from the public registry at a version this monorepo never published |
| The install runs `npm`, not `pnpm` | npm satisfies those transitive ranges from the directly installed siblings. pnpm does not, and its `overrides` do not reach a range from inside a packed tarball either; the same 404 just surfaces one package later |
| A standalone install, not a root workspace member | A member writes an importer into the tracked `pnpm-lock.yaml`, and `experimental/` is gitignored, so that lock would name a directory no other checkout has |

Linking the packages directly was tried first and is not viable. A `link:` resolves through `exports` to untransformed `src/*.ts`, so every sandbox script pays a full compile of the product tree before it does anything; the measured cost was **133 seconds** to reach a first answer, and it is paid again on the next run. Warming that compile is impossible too: `ttsx` writes its emitted output to a **PID-scoped** directory under `node_modules/.cache/ttsc/ttsx/project/`, so no later process reuses it, and a `ttsc` build beforehand changes nothing.

One symptom maps straight to this table: `does not provide an export named` for a symbol the package plainly exports means something is resolving `src` rather than a tarball's `lib`.

A sandbox script fails loudly but exits through a pipe, so `npm run <script> | tail` can print a plausible tail for a command that died. Read the exit code, not the tail.

## Drive It

A sandbox is an ordinary project, so attaching is nothing more than starting there:

```bash
cd experimental/<name>
claude          # or: codex
```

Give the agent a brief and let it work. The agent authors; you observe and record. Do not write its source on its behalf or run its scripts for it, since the point is to see what the project affords a model that has only the shipped skill, the contracts, and the compiler's refusals.

Read [records.md](records.md) before launching a benchmark. It owns the self-contained campaign record, frozen provenance, causal claim ceiling, judgment calibration, ordered operation and recovery receipts, and close audit. Opening the issue from its linked template records a proposal; it does not authorize launch.

Read [briefing.md](briefing.md) before writing the brief for a benchmark, where the agent authors a whole production over many rounds. What the brief withholds, the order it asks the work in, and the instrument that will judge it decide most of what such a run costs, and none of the three can be repaired later without giving up the ability to run the brief again.

Drive the agent turn by turn when you need to play the user across a longer session: `claude -p "<brief>" --session-id <uuid>`, then `claude -p "<next turn>" --resume <uuid>`. Codex resumes with `codex exec resume <session-uuid> "<next turn>"`, naming the session rather than `--last`.

Read [steering.md](steering.md) before driving a session that will run for hours instead of for one prompt. A long session accepts no input while a turn is running, shares the machine with whatever else is running on it, and reports on itself faster than it produces, so the operational rules for keeping one on course are their own document.

Read [comparison.md](comparison.md) before running several productions against one harness at the same time in order to compare them. Several sessions are not one session repeated: the harness has to be frozen before the first writer starts, judgment has to be separated from commissioning, and the comparison itself is a surface no per-production review covers.

## Read The Result

Judge against what the experiment set out to answer, and say plainly when the run did not settle it.

- Separate what the engine accepted from what the render shows. A render that disagrees with the engine result is a viewer bug; one that agrees and still looks wrong is an engine or data bug. Verify anything visual through the viewer-verification skill rather than trusting a tool's success return.
- Verify the instrument before the subject. A sweep script, capture loop, or comparison harness written to observe with is covered by nothing the engine or the viewer guarantees, so a defect in it is indistinguishable from a defect in the work. Say how each claim was obtained: a count read from a compiled artifact is reliable, a frame is worth exactly what the path that produced it is worth, and the two disagreeing makes the instrument the first suspect. An instrument that shows nothing is caught in a minute; one that shows a plausible fraction of the truth survives rounds, because a partial truth reads as a finding.
- Ask the model rather than your own index. What you saw is safe to report; what you did not see is a question until you have asked the model the way the model is organized. Five absences reported in one campaign were all present, and all five came from grepping element id prefixes for something the engine already answers from declared membership: instanced populations invisible to a bare render, hall windows filed under a facade prefix, cloth in a soft-furnishing list rather than a node, seats folded away by the observer's own grouping rule, panelling under a different id stem. The [review skill's rule for a missing capability](../review/SKILL.md#it-is-missing-is-a-claim-that-needs-its-own-evidence) is the same claim about the repository.
- Reproduce before believing. The engine is deterministic and the driving model is not, so a single odd result is not yet a finding.
- Keep repetition inside the claim ceiling. Same-condition runs expose agreement or variability; only a predeclared comparator with one changed axis can support a controlled contrast. [records.md](records.md#declare-the-causal-ceiling) owns the complete disposition matrix.
- Record a suspicion the run cannot settle as a hypothesis with the observation that would confirm it, rather than acting on it.

Never adjust the sandbox to make a result look better. A sandbox edited until it passes has stopped being evidence.

## When An Observation Becomes Work

An experiment is allowed to end with nothing but an answer. Publish an issue only when the observation survives fact-checking against the real code path, and follow the [issue-campaign skill's Self-Contained Issue Body](../issue-campaign/SKILL.md#self-contained-issue-body) contract when you do.

Attribute before publishing: an engine defect, a missing contract axis, a refusal that does not say what to do, and a gap in the shipped skill are automovie's; a model-side failure against an adequate surface is not.

An experiment's issue recommends a fix from outside the code, so write its approach as the hypothesis it is and say what the hypothesis rests on. Three issues from one campaign were reversed by their own implementers: a colour recommendation that would have made both paths wrong together instead of one, a lint marker that failed against six real sentences, and a quantity record that was a claim rather than a measurement. An implementer that contradicts the issue has read the code path the observation could not, so treat the contradiction as evidence.

If the question turns out to need systematic measurement rather than one run, stop and say so; running it informally produces anecdotes that look like data.
