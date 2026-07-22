---
name: issue-campaign
description: Defines the default solo repository-wide issue campaign for automovie: exhaustive discovery, wiki-backed candidate adjudication, main-agent-vetted issue publication, one unified implementation pull request per cycle, CI validation, solo Self-Review, and repeated rediscovery until a full clean round. Use for broad audits, many issue candidates, or repeated issue-to-pull-request campaigns unless the user explicitly requests parallel or multi-agent execution; do not use for one already-defined issue or an ordinary pull request.
---

# Issue Campaign

An issue campaign is a repeatable solo sequence of exhaustive discovery, issue publication, one unified implementation pull request, and renewed discovery. The main agent owns every phase and spawns no subagent other than the read-only commit early-warning pass that [development.md](development.md#implement-and-write-tests) defines.

Use the [multi-agent skill](../multi-agent/SKILL.md) and its issue-campaign procedure instead only when the user explicitly asks for a parallel or multi-agent issue campaign.

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

Do not stop after finding enough work for a pull request. Complete the entire scope, adjudicate the full candidate pool, and publish only the surviving issues when authorized.

### Every Round Is Full-Scope

Every round re-audits the entire declared scope against the current integrated state. A round is never partitioned: not by package, file, concern, platform, candidate class, or validation lane, not by the areas the last cycle happened to touch, and not by splitting the scope across rounds so that each one covers a slice. A merged cycle changes the state every earlier conclusion rested on, so what an earlier round read is not coverage for this one. The [review skill's Non-Negotiable Review Law](../review/SKILL.md#non-negotiable-review-law) states the same rule for every round and review the campaign runs.

### Discovery Ends Only On An Empty Round

A merged cycle does not end the campaign. It produces one more round: begin a fresh full-scope round against the integrated repository. Discovery continues cycle after cycle, with no round limit, and ends only when one complete fresh round produces no meaningful issue candidate after fact-checking and no accepted issue remains unresolved.

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

Read [development.md](development.md) in full when the user authorizes implementation pull requests or a standing autonomous mandate covers them. It owns the one-PR cycle, empty claim, internal DAG order, test authoring, local and CI validation, solo Self-Review, red-CI repair, merge, branch cleanup, and renewed discovery.

An audit or issue-publication-only campaign does not load the implementation procedure or mutate repository or GitHub state beyond the authorized publications.
