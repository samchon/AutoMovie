---
name: experiment
description: Defines how automovie runs an ad-hoc experiment: creating a disposable source-linked sandbox under experimental/, briefing and steering a live Claude Code or Codex session that authors inside it against working-tree code, and deciding what an observation is worth. Use when the user asks to try something out, drive a generated project by hand, run a benchmark against an authoring agent, or see how a change behaves through a real agent; do not use for a render inspection of something already running (viewer-verification) or a repository-wide audit (issue-campaign).
---

# Experiment

An experiment answers one question by running the real thing. Create a disposable sandbox, drive it with a live agent, read what happens, and throw the sandbox away.

The sandbox must execute the package revision being investigated. [Create The Sandbox](#create-the-sandbox) owns dependency provenance and the refresh boundary; a source change outside the sandbox is not proof that its next run uses that change.

An experiment produces an observation, not a score.

Read the [project](../project/SKILL.md) and [scaffold](../scaffold/SKILL.md) skills before driving a sandbox, and the [viewer-verification](../viewer-verification/SKILL.md) skill before claiming anything about a render.

## Create The Sandbox

Choose one explicit, disposable path under `experimental/` for the authorized question. Resolve its absolute location and inspect any existing content before creation or replacement; the committed manor is not a disposable target.

Use the ordinary project creator described by the [CLI surface](../../../packages/cli/README.md#cli-surface), with the requested language. For a working-tree experiment, invoke the CLI and template built from the revision under investigation rather than silently downloading a registry release. The scaffold's [ownership contract](../../../packages/template/scaffold/README.md#ownership) applies inside the sandbox.

Install the required package generation through ordinary package-manager commands. Record the exact revisions, resolved entry points, and dependency versions before launching the agent. The creation command alone does not establish that the sandbox consumes local package changes.

Preserve the authored production when updating dependencies. Rebuild and reinstall the affected package generation, verify what the sandbox actually resolves, and establish a new observation basis before the next run. Recreating a blank scaffold over existing work is not a dependency refresh.

Create a disposable sandbox only for an active experiment. Delete the sandbox and its temporary scripts, logs, and captures when its question is answered; retain only the findings and verification records needed by the owning workflow. Never commit disposable content, hide it with a broad `experimental/` ignore rule, or leave it as untracked working-tree clutter after the experiment.

## Verify The Consumer Boundary

Verify the installed dependency closure, including transitive workspace packages, before interpreting a sandbox failure as a product defect. The execution path must apply the required TypeScript transforms and resolve the generation recorded for the run; a package name or version string alone does not establish either property.

Keep a disposable sandbox outside the tracked workspace membership. Its installation must not add a transient importer to the repository lockfile. If the chosen installation cannot resolve unpublished sibling dependencies, correct the package installation before launching the experiment rather than changing product source to hide the mismatch.

When an export is missing, inspect the actual resolved module and its emitted exports. Do not assume that every resolution error has the same cause. Read the invoked command's exit code directly; a successful output filter is not evidence that the command it filtered succeeded.

## Drive It

A sandbox is an ordinary project, so attaching is nothing more than starting there:

```bash
cd experimental/<name>
claude          # or: codex
```

Give the agent a brief and let it work. The agent authors; you observe and record. Do not write its source on its behalf or run its scripts for it, since the point is to see what the project affords a model that has only the shipped skill, the contracts, and the builder's refusals.

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
