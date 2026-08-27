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

Source is only one evidence layer. Exercise real workflows: run a generated project's own scripts, render through the viewer with the viewer-verification skill, run the coverage gate when the phase authorizes it, and inspect relevant upstream behavior, history, consumers, fixtures, public documentation, and closed decisions.

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

Write enough context for a fresh AI agent to begin implementation from the issue alone. Do not require access to the local `.wiki`, the discovery conversation, or unstated repository knowledge. Cover these sections when they apply, except **Scope**, which every issue carries:

- **Problem:** current and expected behavior, impact, and affected users.
- **Evidence:** exact reproduction, outputs or renders, stable symbols, verified root cause, ownership, and provenance. For a violation of the development skill's **Forbidden** section, prove the classification from behavior, control flow, and history instead of merely naming the prohibition. Line numbers are navigation, not proof.
- **Consequence surface:** affected consumers, states, platforms, compatibility and failure paths, plus the complete case matrix for the cause.
- **Approach:** the invariant and architectural owner, without prescribing an unverified implementation.
- **Scope:** every layer this one topic crosses, each answered, including the layers whose answer is that they do not apply. [An Issue Stands Vertically](#an-issue-stands-vertically) owns this section.
- **Acceptance and verification:** positive, negative, boundary, and regression outcomes with narrow and broader proving commands, including the coverage gate.
- **Coordination:** dependencies, exclusions, migration concerns, external blockers, and related open, closed, accepted, or rejected work.

Use tables for repeated case mappings. Read the rendered issue back and keep its body as the current operative handoff; use comments only for chronology.

### An Issue Stands Vertically

An issue is one topic, not one package. Walk the topic down the contract before publishing and answer every layer in the body, because an issue that claims one layer and calls the rest separate hands its implementer a package-shaped fragment.

| Layer | What the body answers |
| --- | --- |
| `docs/requirements` | Which requirement already promises this capability, or which promise the topic adds |
| `docs/specifications` | Which specification makes that promise precise |
| `packages/*` | Which package owns the logic, and which anchors its public exports cite |
| Sandbox engine surface | Whether authoring source has to call it, and through which surface entry and bridge |
| `packages/template/scaffold/.agents/skills` | How an authoring agent comes to know the capability is there |
| Tests | Reachability and the negative twin, not the logic alone |

The table is the floor, not the boundary. A topic that also crosses the scaffold, the viewer, CI, the evidence configuration, or a skill lists that layer beside the six.

**"Not applicable" is an answer and silence is not.** Write the layer down with the reason it does not apply. A layer the body never mentions is a layer nobody decided about, and the decision then falls to whoever notices it later.

Name each layer's obligation by pointing at the skill that owns it. The [evidence graph skill](../evidence-graph/SKILL.md) owns what the two document layers hold and how a public export cites them, the [scaffold skill](../scaffold/SKILL.md) owns the authoring skill a generated project ships, and the development skill's rule that [a solver lands with the consumer that calls it](../development/SKILL.md#work-rules) owns the same obligation inside a single change. A second copy of any of those drifts from the original, and this repository has already shipped a guide README promising a gate nothing performed.

The failure this contract exists to prevent is a capability that exists and cannot be reached. One campaign recorded it six times (`#1904`, `#1915`, `#1917`, `#1920`, `#1930`, and `builtEnvironmentSpaceNodes`): logic that worked, with nothing exposing it, listing it, or naming it where an author would look. In `#1904` the authoring agent was told the right technique, given no way to perform it, and invented a workaround the guides explicitly forbid.

The last of those cases is why a surface entry alone does not discharge that layer. The function was listed, its JSDoc described it accurately, the reviewer who needed it had already read the surface list, and it still went uncalled. Published, documented, and reachable are three different states, so the guide layer answers how an author arrives at the capability rather than whether its name appears anywhere.

### Read The Upper Layer First

Answer the layers downward, from `docs/requirements` toward the tests. A topic that starts at the code and back-fills the documents afterwards turns a requirement into a description of what was already built, which points the evidence graph the wrong way.

Reading `docs/requirements` first also changes what the issue turns out to be. A later campaign reversed six of its ten issues at self-review for this reason alone (`#1929`, `#1930`, `#1934`, `#1935`, `#1936`, `#1937`): the requirement was already written, so what read as a new capability was an unmet promise, and the two carry different acceptance and a different fix. The review skill's ["It is missing" rule](../review/SKILL.md#it-is-missing-is-a-claim-that-needs-its-own-evidence) states the four checks that settle which one it is.

## Develop And Repeat The Campaign

Read [development.md](development.md) in full when the user authorizes implementation pull requests or a standing autonomous mandate covers them. It owns the one-PR cycle, the empty claim, the DAG wave grouping, path ownership between parallel owners, per-owner Self-Review and push, integration of each owner's hand-off, local and CI validation, the integration Self-Review, red-CI repair, merge, branch cleanup, and renewed discovery.

An audit or issue-publication-only campaign does not load the implementation procedure or mutate repository or GitHub state beyond the authorized publications.
