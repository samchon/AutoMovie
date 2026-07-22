---
name: benchmark-campaign
description: Defines the default solo empirical MCP benchmark loop for automovie: authoring a persistent scenario corpus, driving the live MCP surface with an external agent (Claude, Codex), scoring and attributing each run, publishing main-agent-vetted defect and gap issues, developing every one in one cycle pull request, and only then re-running the corpus. Use when the user wants to benchmark the pipeline through real MCP runs, generate and exercise short/medium/long scenarios, or turn benchmark shortfalls into an issue-to-pull-request campaign unless the user explicitly requests parallel or multi-agent execution; do not use for a static code audit (see the issue-campaign skill) or one already-defined issue.
---

# Benchmark Campaign

A benchmark campaign measures automovie through real use and turns every shortfall into work: author a diverse scenario corpus, drive the live MCP surface with an external agent (Claude, Codex), score and attribute each run, publish the automovie-owned defects and gaps as main-agent-vetted issues, implement every one of them, and only then re-run the corpus to measure again. It is the empirical counterpart to the issue campaign (issue candidates come from lived runs and rendered output, not from a static audit), and it inherits that skill's main-agent-vetted publication, self-contained issue body, one-PR cycle implementation, and closure discipline.

This document is the whole default campaign procedure. The main agent performs every campaign phase and spawns no subagent other than the read-only commit early-warning pass that the [solo development procedure](../issue-campaign/development.md#implement-and-write-tests) defines for the implementation phase. Authoring, running, scoring, and triage are never delegated: an external agent drives the MCP tools as the measured subject, which is the opposite of a subagent doing the campaign's work.

Use the [multi-agent skill](../multi-agent/SKILL.md) and its benchmark-campaign procedure instead only when the user explicitly asks for a parallel or multi-agent benchmark campaign.

The measure–fix–measure order is the campaign's spine: a benchmark cycle does not re-run until every issue discovered in the current cycle is developed and merged. Measuring against a surface with known, unfixed gaps wastes the run and muddies attribution; the corpus is re-driven only after the full fix wave lands.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every launch, score, attribution, publication, and implementation decision. A run's cost and duration decide how carefully it is prepared, never what counts as a pass.

Read the project, development, review, mcp, viewer-verification, and pull-request skills before starting. Use the review skill's Solo Issue Discovery Rounds. The user's requested phase boundary controls how far to proceed: an author-and-run request does not authorize publishing issues, pushing branches, or merging. A standing autonomous mandate (see the pull-request skill) authorizes only the actions it explicitly names. The boundary binds harder here because a run is itself an expensive, long-running action that consumes the external agent's model quota: when the user has not asked for the whole loop, say which corpus, how long, and at whose cost before starting one.

## Benchmark Knowledge Base

Create `.wiki/09-benchmarks/<benchmark>/` with a short filesystem-safe name, parallel to `.wiki/08-campaigns/`. Preserve and reconcile any existing benchmark directory rather than assuming a blank slate. Like the rest of `.wiki/`, benchmark notes are written in Korean.

The corpus and its run records are the benchmark's durable asset, not scratch. Never discard them. Keep concise, current Markdown for:

- the **scenario corpus**: each scenario's intent, duration/complexity tier, capability axes exercised, and expected observable result;
- **run records**: per run, the agent and exact model id, the brief given, the full tool-call trace, every tool output and validation result, the rendered output, retries, and cost;
- the **triage ledger**: each shortfall's attribution, evidence, and main-agent disposition; and
- **implementation and regression**: the published-issue DAG, internal implementation order, one unified cycle pull request, official empty-claim `createdAt`-to-`mergedAt` duration, verification, and the before/after runs that confirm each fix.

The knowledge base supports the campaign but is not the issue body: a published issue must stand alone without `.wiki`, which is gitignored and invisible to a fresh implementer.

`.wiki/` is also machine-local, so the canonical run-by-run results belong in a durable ledger that survives across machines and sessions: a dedicated GitHub issue, appended to and never rewritten, recording each run's scenario set, agent and model id, scores, and cost. A killed or invalidated run stays in that ledger's notes, never as a comparison row.

## Author The Scenario Corpus

An AI authors the scenarios (the requested count, about ten by default) spanning short, medium, and long duration and rising ambition. Diversity is mandatory: cover the capability surface across single and multiple characters, pose, motion, expression, camera, scene, light, time, props, and parametric forge, and deliberately reach past the current schema to probe the extensibility frontier the project mission commits to.

Each scenario is a self-contained brief a fresh external agent can attempt from the MCP surface alone: the film beat to realize, the expected observable result, the duration/complexity tier, and the capability axes it exercises. Do not tune scenarios to what already works; a reach scenario expected to expose a missing axis is the strongest signal for the additive-axis mission. Version the corpus and add to it. Earlier scenarios persist as the regression suite; reconcile, never silently replace.

## Run The Benchmark

Launch only from a state whose measurement will still mean something: the suites green at 100% coverage, and every change under test merged into `master`. A build that compiles is not a validated build, and "the remaining failures are probably unrelated" is an assumption, not evidence. A run started from an unverified tree spends its hours producing evidence about a state that will never exist again; kill it, discard its records so nothing later mistakes them for a result, and note the aborted attempt in the knowledge base rather than the ledger.

Work through the scenarios in ascending cost, short tier first. A regression in a shared path breaks every scenario, so it is worth finding on the cheapest one; reserve the long, ambitious scenarios for the claims only they can adjudicate.

Drive the live MCP server through a real external-client handshake (see the mcp skill and `packages/mcp/README.md`) using the actual target agent (Claude, Codex), never an in-repo mock or the main agent standing in for the model. The external agent drives the tools; the main agent observes and records.

Record every run in the knowledge base: agent and model id, the brief, the complete tool-call trace, each tool output and validation result, the rendered output (verified through the viewer-verification skill for anything visual), and the retries and cost.

The engine is deterministic; the driving LLM is not. Reproduce a failure (re-run the scenario with a comparable agent) before it becomes evidence. A single flaky miss is not yet a defect, and the reproduction is part of the record.

## Score And Triage

Score each run against its scenario's expected result on a stable rubric recorded in the knowledge base: validity (the engine accepts the input), renderability, fidelity to intent (viewer-verified), controllability, and friction (tool-call count, retries, dead-ends).

Triage every shortfall by attribution before it can become an issue:

- **engine defect**: a validator rejects valid input, math is wrong, or output is non-deterministic;
- **interface gap**: no schema axis can express what the scenario needs (the extensibility signal, additive by mission);
- **MCP-surface friction**: a tool's shape, description, or length constraint makes it unusable or misleading (mcp skill);
- **guide/prompt-corpus gap**: the agent lacked the guidance to use an adequate surface (`packages/mcp/prompts`);
- **model-side failure**: the surface was adequate and the agent still erred; not an automovie code issue, though it may motivate a guide improvement.

Only the first four are automovie-owned issues. Prove attribution from the trace, the engine result, and the schema, not from a guess; a model-side classification holds only once you have shown the surface was adequate and the miss reproduced. Cross-check engine against render per the viewer-verification skill: a render that disagrees with the engine result is a viewer bug; one that agrees but still looks wrong is an engine or data bug.

## Evidence-First Discipline

The run, not a theory, decides whether a change is needed.

- Record a suspicion the current runs cannot settle as a hypothesis in the knowledge base, together with the exact observation that would confirm or refute it. Do not implement a hypothesis before a run adjudicates it, unless the repository proves the defect on its own.
- Reserve a rich claim for a scenario that can adjudicate it. A short single-character scenario cannot settle camera, scene, or multi-actor expressiveness.
- Never loosen a rubric, a validator, or a scenario's expected result to make a run score better. A benchmark that fails honestly is worth more than a green one that lies; that failure is the entire product of the campaign.
- A discovery round is never held open waiting for a run. Judge each round against the current tree and the most recent completed runs; a run that finishes afterwards opens a new round over what it produced.
- A round that produces a shortfall is followed by another full-scope round over those same runs and tree, and publication waits for the round that adds nothing. The second reading of a trace carries what the first round proved, which is what separates one scenario's symptom from the cause sitting under several of them.

## Vet And Publish Issues

Publication follows the issue-campaign skill's Vet And Publish Issues phase unchanged: the main agent owns every decision, reopens and reproduces the evidence, traces the consequence surface, compares open and closed work, and records the disposition. Publish only the adjudicated form, and only with user authorization or under a standing autonomous mandate.

Write each body to that skill's Self-Contained Issue Body contract, adding the benchmark evidence a fresh implementer needs to reproduce without `.wiki`:

- the scenario brief and its expected result;
- the reproducing run: agent and model id, the exact MCP call sequence, and the observed output or render versus expected;
- the attribution proof from trace, engine result, and schema.

State an interface-gap issue as a missing axis in extensibility terms (additive, never a rewrite) per the project mission; target a guide/prompt-gap issue at `packages/mcp/prompts` per the mcp skill.

## Develop Every Issue, Then Re-Benchmark

When the user authorizes implementation or a standing autonomous mandate covers it, implement by the issue-campaign skill's [solo development procedure](../issue-campaign/development.md): one empty-claim pull request containing every implementation-ready issue, DAG-ordered edits, complete coverage, local and CI validation, solo Self-Review, red-CI repair in the same pull request, merge, cleanup, and renewed discovery. An author-run-and-publish-only campaign does not load it.

Four of that procedure's mechanics carry benchmark-specific weight:

- **The claim body carries no closing keyword.** A benchmark cycle is the likeliest place for an issue to narrow under implementation, because the run that motivated it measured a symptom and the fix adjudicates a cause. Let each commit's `Close #n: <issue title>` line decide what the merge closes, so an issue that ships only its durable half stays open on its own evidence instead of needing a hand-written exemption in a body written before the code existed.
- **A fix the cycle reverts loses its closing line too.** A benchmark cycle reverts a fix when the evidence turns against it, and the [merge gate](../issue-campaign/development.md#merge-and-clean-up) reconciles the closing keywords against what survives at `HEAD` for exactly that case: an issue whose fix the cycle removed stays open on the shortfall that still stands.
- **The per-commit review ledger names the run it answers.** Give each commit's ledger review the scenario and run record behind the issue it resolves, so the before/after re-run has a per-commit anchor and the durable run ledger can cite the exact commit that changed a score.
- **The durable run-ledger issue never appears in a closing line.** It is an append-only record for the whole campaign, not a cycle deliverable, and a stray keyword would close the campaign's own log.

### Every Cycle Re-Runs The Whole Corpus

The cycle's gate is total: the next benchmark measurement begins only after **every** issue from the current cycle is merged, not after a subset.

That measurement re-runs the affected scenarios and the whole corpus against the fixed surface, recording the before/after runs so each fix's effect is measured, and re-triages what remains. A measurement is never partitioned: not by the scenarios the last cycle's fixes happened to touch, not by tier, and not by splitting the corpus across cycles so that each one drives a slice. A merged fix wave changes the surface every earlier run measured, so an earlier run is not coverage for this one.

### The Campaign Ends Only On A Clean Full Run

A merged fix wave does not end the campaign. It produces one more measurement: extend the corpus with new reach scenarios, drive the whole corpus, and repeat. The campaign ends only when a full corpus run against a fully-developed surface surfaces no automovie-owned shortfall that survives main-agent fact-checking.

Report the campaign complete only from a run that actually came up clean. Ending after a cycle whose fixes merely looked sufficient leaves the shortfalls the next run would have measured unrecorded.
