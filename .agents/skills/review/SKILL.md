---
name: review
description: Defines exhaustive review, Self-Review, and solo repository-wide issue-discovery rounds for automovie. Use for every self-review or unqualified review request and as the review mode inside issue campaigns, where each parallel issue owner reviews its own surface and the main agent then reviews the integrated diff. One reviewer always covers one whole declared surface; this skill never splits a surface across agents. Use the multi-agent skill only when the user explicitly requests a team, parallel, or multi-agent review.
---

# Review

## Non-Negotiable Review Law

One reviewer performs every review in this skill from scratch over the entire declared surface. Do not spawn a subagent, delegate a concern, or load the discussion skill.

The unit the law governs is one declared surface, not one person. An issue campaign runs several reviews under it: each parallel owner reviews its own issue's whole surface, and the main agent then reviews the whole base-to-head diff. Both are complete rounds under all four rules. What the law forbids is splitting one declared surface across reviewers, and it forbids the integration round inheriting any owner's round.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every review decision. A review's duration, difficulty, and consequence surface are reasons to inspect more deeply, never reasons to pass over a sound improvement, accept an unsupported claim, or lower the completion standard.

A complete round must satisfy all four rules:

- **Whole surface:** read every changed file and hunk. For issue discovery, audit the entire campaign scope. Never partition by file, package, concern, platform, or round.
- **Consequence surface:** inspect affected code paths, tests, rendered output, CI, packaging, documentation, and consumers. Trace side effects, state transitions, determinism, numeric and quaternion behavior, Windows and POSIX behavior, public API compatibility, boundaries, and failure and recovery paths beyond the named symptom or diff.
- **Fresh start:** use the current state and repeat the whole inspection. Earlier rounds, sampled files, and a recheck of only the latest fix do not count as coverage.
- **Unlimited rounds:** whenever the reviewer applies an improvement or accepts a meaningful issue candidate, update the work and start another complete round. Stop only after a complete round produces nothing that survives verification.

## Review records belong to the procedure

AutoMovie has no repository review service, finding ledger, approval state, or waiver store. A repository review record is the Git and pull-request chronology produced while following this skill. A generated production follows its shipped [production review procedure](../../../packages/template/scaffold/.agents/skills/review-verification/review.md) instead; neither workflow invents a second product ledger.

Declare the exact branch, base and head, working-tree state, artifact revision, and file or rendered-output population the round reads. A conclusion applies only to that surface. A clean check, an empty finding set, elapsed time, or a judgment over one file never implies a wider approval.

Write each finding at the narrowest reproducible location: changed line, public symbol, test case, diagnostic, target identity, frame, interval, subject, or render view. Separate what was observed, what the contract requires, the resulting consequence, and any cause proved from control flow or history. An unproved cause stays a hypothesis.

Compare alternatives only when their source, intent, platform, inputs, event or time position, and presentation conditions make the comparison meaningful. Name the common basis and the actual difference. If the basis does not match, report the comparison limit instead of ranking the candidates.

Classify a verified finding by affected contract or behavior, impact, reproduction conditions, and repair priority. Impact and priority are different facts. Several manifestations may share one root cause, but each reproducing location remains evidence until the whole class is repaired.

Preserve history through commits and formal pull-request reviews. A later correction explains and supersedes an earlier finding without rewriting the earlier observation. A Self-Review `COMMENT` is a process record, never an approval, rejection, conditional approval, or waiver on behalf of a person or organization.

## Self-Review

Self-Review and an unqualified review request use this solo workflow:

1. Establish the complete change surface, including the pull request base-to-head diff and any uncommitted changes.
2. Perform one complete round under the Non-Negotiable Review Law. Include correctness and boundaries, numeric and quaternion behavior, determinism, Windows and POSIX behavior, state, public API compatibility, test isolation and the 100% coverage mandate, CI and packaging, documentation and the `.wiki`, the [evidence graph skill](../evidence-graph/SKILL.md) for any changed requirement, specification, public citation, or graph configuration, and the viewer-verification skill for anything visual.
3. Reproduce every suspected defect before accepting it.
4. Apply every sound improvement and run the narrowest verification authorized by the owning workflow.
5. If anything changed, restart at step 1 as a fresh full round.
6. Finish only when a complete round finds nothing to improve. Report the final clean round and every verification that could not run.

Self-Review does not authorize creating, pushing, updating, or merging a pull request. Those actions follow the pull-request skill's own authorization rules.

## Campaign Reviews Do Not Add Up

An issue campaign's parallel owners each complete a Self-Review over their own issue, and the main agent completes one over the integrated diff. The [campaign development document](../issue-campaign/development.md#validate-with-ci-and-the-integration-self-review) defines both.

The owners' rounds never substitute for the integration round. An owner reads the surface of one issue, so what appears only between issues is invisible to all of them: a helper two owners wrote twice, a validator whose new branch leaves a mirrored DTO stale, a document claiming a verification nothing performs, a limit one owner recorded honestly and another silently relied on.

Never report the owners' rounds as the campaign's Self-Review. A reader who sees that name concludes the gate already ran, and the whole-surface round disappears without anyone deciding to drop it.

## Solo Issue Discovery Rounds

Use these rounds only through the solo issue-campaign skill.

1. Audit the entire declared campaign scope yourself. Inspect source, tests, documentation, CI, packaging, rendered output, platform behavior, sibling-repository and upstream provenance, and open and closed issue or pull-request history. Audit the current implementation and history against the development skill's **Forbidden** section. A verified violation remains meaningful even when tests pass and coverage reads 100%.
2. Record every raw candidate and its evidence in the campaign knowledge base before adjudication. Do not silently discard a suspicion because it looks duplicative or inconvenient.
3. Reopen each candidate from primary evidence, reproduce it, verify ownership and provenance, trace its complete consequence surface, and prove any claimed **Forbidden** classification from purpose, control flow, consequence, and history.
4. Record accept, partial acceptance, rewrite, combine, split, reject, or defer. Keep the disposition and reason in the knowledge base so later passes do not rediscover a rejected premise as new.
5. If any meaningful candidate survived this round, return to step 1 and run another complete round over the entire scope at the same repository state. Rounds repeat until one of them adds no meaningful candidate.
6. Publish only the adjudicated form of what survived, taken from every round the phase ran, and only when the campaign is authorized to publish.
7. After the authorized implementation cycle merges, begin again at step 1 over the integrated state.

An unresolved accepted issue, external blocker, or incomplete implementation prevents a successful campaign conclusion. Report it as blocked or active rather than treating it as a clean round.

## "It is missing" is a claim that needs its own evidence

A failed search proves a name was not found, not that a capability is absent, and least of all that its absence was unintended. This repository records deliberate omissions in contract JSDoc and in the guide corpus rather than anywhere a grep for the capability would reach, so a candidate resting on a search result is the most common way a round produces work that has to be withdrawn; one campaign withdrew a third of what it published this way.

Complete all four steps before writing that something is missing.

1. Read the contract type's JSDoc. Deliberate exclusions are stated there ("the sun direction is an input, not a computation").
2. Search all four shipped authoring skills under `packages/template/scaffold/.agents/skills/{production-lifecycle,evidence-graph,source-authoring,review-verification}/` in the user's vocabulary rather than the implementation's. They teach in a director's words (a curtain, a ridge, a reverberant room), so probing them only with type names finds nothing even where the topic is covered.
3. Check whether related fields already exist and, if they do, read why. Half a mechanism usually means the other half was deferred under another name.
4. Confirm the probe. Verify how the target is actually spelled, count consumers by exported symbol rather than by module filename, and read checked-in source rather than a generated artifact.

When the steps turn up a declared position, the finding is not "this is missing" but "this was deferred, and here is what now lets it be done deliberately and within stated bounds", which carries a different burden of proof.

"It is already there" needs the same discipline, because a symbol's existence is not a path's existence. One round withdrew a real gap after finding an ingest function and a retargeter, and the capability was still unreachable: nothing in the pipeline called the ingester, the asset manifest had no kind to declare the file under, and the retargeter was absent from the sandbox surface an authoring agent may import. Before writing that a capability exists, confirm all four: the contract gives an author somewhere to declare it, something in the compiler or runtime calls it, the author can reach the symbol, and the result shows up in a frame or in evidence.

## A claim the compiler can decide is not a review criterion

Looking is expensive. It costs frames, an agent's attention, and a written justification, and every verdict it produces stales the moment anything upstream moves. So the boundary worth defending is not "what could a reviewer look at" but **what can only be settled by looking**.

Two requirements already draw that line, and they point the same way. `docs/requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance` asks a story success condition to carry a subject, a time or event, an observable state, and a failure condition, and forbids it ending in a bare evaluative word. `docs/requirements/story/scenes-and-observable-action.md#story-scene-observability` forbids resting acceptance on inner facts a camera cannot see. A claim that satisfies the first is by construction a predicate; a claim that needs the second is by construction pixels.

Sorted by that test, a production's obligations split cleanly. Binding, exports, determinism, engine enforcement, and error paths are settled by reading the module. Identity, references, scope, ownership, ranges, and downstream consumability are settled by the records and the compile diagnostics. Acceptance outcomes are already the compiler's: it returns an explicit verdict per authored opening, closing, event, camera, actor, and formation predicate. What is left over : whether a silhouette reads, whether a performance is credible, whether a cut lands, whether a rendition holds together : is settled by looking, and by nothing else.

The first group is the larger one. That is the whole argument for keeping it out of a person's hands: a compiler does not tire, does not stale, and names the exact figure that disagrees.

So when a review keeps producing the same class of finding, ask whether it is a diagnostic in the wrong place. And measure what already refuses the case before writing the check that refuses it again : a regex beside a parser looks like new coverage and is a second, worse spelling of a rule that already held.

This is not an argument against looking. It is what keeps looking affordable: let the compiler decide every addressed, timed, observable claim, and spend the frames on what only frames can answer. Then say what the frames showed, in the evidence citation on the source that claims the unit is realized. A citation that names no observation is not a review, and nothing records one on your behalf.

## Explicit Multi-Agent Reviews

When the user explicitly asks for a team, parallel, or multi-agent review, load the [multi-agent skill](../multi-agent/SKILL.md) and its review procedure instead of this workflow. It inherits the same whole-surface and fresh-round law while defining independent parallel reviewers and lead adjudication.
