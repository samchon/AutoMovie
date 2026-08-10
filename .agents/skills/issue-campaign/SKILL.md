---
name: issue-campaign
description: Defines the repository-wide issue campaign for automovie: exhaustive solo discovery, wiki-backed candidate adjudication, main-agent-vetted issue publication, then DAG-ordered parallel implementation by one owner per issue in one checkout and one branch, each owner Self-Reviewing and pushing its own work, closed by one main-agent integration Self-Review and CI on a single cycle pull request. Use for broad audits, many issue candidates, or repeated issue-to-pull-request campaigns; do not use for one already-defined issue or an ordinary pull request.
---

# Issue Campaign

An issue campaign is a repeatable sequence of exhaustive discovery, issue publication, one unified implementation pull request, and renewed discovery.

The phases divide differently:

- **Discovery, adjudication, and publication are solo.** The main agent audits the whole declared scope itself, reproduces every candidate, and decides every disposition. Splitting discovery hides the overlaps that make two candidates one issue.
- **Implementation is parallel.** One owner per accepted issue, dispatched in dependency-DAG waves, all in the same checkout on the same branch. Each owner Self-Reviews its own surface, commits its own paths, and pushes.
- **The close is solo again.** The main agent integrates the shared surfaces and runs one integration Self-Review over the whole base-to-head diff.

[development.md](development.md) owns that implementation procedure in full.

This is the ordinary campaign shape and needs no special request. The [multi-agent skill](../multi-agent/SKILL.md) covers only the topologies this one does not use: isolated worktrees, per-batch branches, per-batch pull requests, and parallel discovery or review.

The user's requested phase boundary controls how far to proceed. Do not infer permission to publish issues, push branches, open pull requests, or merge from an audit-only request. A standing autonomous mandate (see the pull-request skill) authorizes only the remote actions it explicitly names.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every admission, disposition, implementation, and review decision. A campaign's scale, duration, and blast radius demand stronger evidence and deeper consequence analysis; they never justify admitting an unverified candidate or accepting a weaker implementation or review standard.

Read the project, development, and review skills before starting. Use the review skill's Solo Issue Discovery Rounds.

## Campaign Knowledge Base

Create `.wiki/08-campaigns/<campaign>/` with a short filesystem-safe campaign name. Preserve any existing campaign directory and reconcile it rather than deleting or assuming a blank slate. Like the rest of the `.wiki/`, campaign notes are written in Korean.

Keep concise, current Markdown documents for:

- the campaign scope, architecture, validation ownership, product boundaries, and provenance notes;
- experiments, reproductions, dogfooding, and related issue or pull-request history;
- every raw candidate, its evidence, dependencies, and final disposition;
- candidate combinations, splits, rejections, deferrals, and the evidence supporting each decision; and
- the published-issue DAG, implementation order, the single cycle pull request, CI and Self-Review iterations, external blockers, campaign timing, and cleanup state when those phases apply.

Record raw candidates before fact-checking. The knowledge base is the durable place to collect overlapping observations, then combine, split, rewrite, reject, or defer them without losing why.

The knowledge base supports the campaign but is not the final issue body. A published issue must stand alone without access to `.wiki`: the wiki is gitignored and never visible to a fresh implementer.

## Discover Issues

Run the review skill's Solo Issue Discovery Rounds over the entire declared campaign scope.

Source is only one evidence layer. Exercise real workflows: drive the MCP tools, render through the viewer with the viewer-verification skill, run the coverage gate when the phase authorizes it, and inspect relevant upstream behavior, history, consumers, fixtures, public documentation, and closed decisions.

Treat the development skill's [Forbidden](../development/SKILL.md#forbidden) section as an explicit retrospective audit contract, not only a rule for future changes. In every complete round, inspect the current implementation and its history for violations, including code that predates the campaign or passes every test at 100% coverage. A verified violation is a meaningful issue candidate. Prove the classification from purpose, control flow, consequence, and history; resemblance or stylistic preference alone is not evidence.

### Every Round Is Full-Scope

Every round re-audits the entire declared scope against the current integrated state. A round is never partitioned: not by package, file, concern, platform, candidate class, or validation lane, not by the areas the last cycle happened to touch, and not by splitting the scope across rounds so that each one covers a slice. A merged cycle changes the state every earlier conclusion rested on, so what an earlier round read is not coverage for this one. The [review skill's Non-Negotiable Review Law](../review/SKILL.md#non-negotiable-review-law) states the same rule for every round and review the campaign runs.

### One Cycle Costs As Many Rounds As It Takes

A productive round is followed by another full-scope round at the same repository state, not by publication. Enough work for a pull request is not a stopping condition.

Adjudicate what the round produced, re-audit the whole scope, and repeat until one round adds no meaningful candidate. Only that empty round closes the discovery phase, and the authorized publication then covers the entire pool those rounds accumulated.

Stopping at the first productive round costs more than it saves. The issues a second round would have found do not disappear; they surface a cycle later, on top of the edits the first cycle already landed, where the same cause is harder to read and its fix has to account for work that was not there when it was written. A cycle is meant to be everything the current state can yield, which is what keeps the campaign converging instead of merely continuing.

### A Merged Cycle Reopens Discovery

A merged cycle does not end the campaign. It reopens discovery: begin a fresh full-scope round against the integrated repository and run the rounds again until one comes up empty.

Discovery continues cycle after cycle with no round limit. It ends only when one complete fresh round produces no meaningful issue candidate after fact-checking and no accepted issue remains unresolved.

Report the campaign complete only from a round that actually came up empty. Ending after a cycle that merely felt thorough leaves the issues the next round would have found unrecorded.

## Vet And Publish Issues

The same main agent owns every publication decision. For each candidate:

1. Reopen its evidence and reproduce the behavior.
2. Verify ownership, provenance, and any claimed classification under the development skill's **Forbidden** section.
3. Trace the full consequence surface.
4. Compare open and closed issues and pull requests.
5. Record accept, partial acceptance, rewrite, combine, split, reject, or defer with the supporting evidence.

Publish only the adjudicated form, and only with user authorization or under a standing autonomous mandate.

### Self-Contained Issue Body

Write enough context for a fresh AI agent to begin implementation from the issue alone. Do not require access to the local `.wiki`, the discovery conversation, or unstated repository knowledge. Cover these sections when they apply:

- **Problem:** current and expected behavior, impact, and affected users.
- **Evidence:** exact reproduction, outputs or renders, stable symbols, verified root cause, ownership, and provenance. For a violation of the development skill's **Forbidden** section, prove the classification from behavior, control flow, and history instead of merely naming the prohibition. Line numbers are navigation, not proof.
- **Consequence surface:** affected consumers, states, platforms, compatibility and failure paths, plus the complete case matrix for the cause.
- **Approach:** the invariant and architectural owner, without prescribing an unverified implementation.
- **Acceptance and verification:** positive, negative, boundary, and regression outcomes with narrow and broader proving commands, including the coverage gate.
- **Coordination:** dependencies, exclusions, migration concerns, external blockers, and related open, closed, accepted, or rejected work.

Use tables for repeated case mappings. Read the rendered issue back and keep its body as the current operative handoff; use comments only for chronology.

## Develop And Repeat The Campaign

Read [development.md](development.md) in full when the user authorizes implementation pull requests or a standing autonomous mandate covers them. It owns the one-PR cycle, the empty claim, the DAG wave grouping, path ownership between parallel owners, per-owner Self-Review and push, integration of each owner's hand-off, local and CI validation, the integration Self-Review, red-CI repair, merge, branch cleanup, and renewed discovery.

An audit or issue-publication-only campaign does not load the implementation procedure or mutate repository or GitHub state beyond the authorized publications.
