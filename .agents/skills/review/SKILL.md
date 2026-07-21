---
name: review
description: Defines exhaustive solo review, Self-Review, and solo repository-wide issue-discovery rounds for automovie. Use for every self-review or unqualified review request and as the default review mode inside issue and benchmark campaigns. This skill never spawns review agents; use the multi-agent skill only when the user explicitly requests a team, parallel, or multi-agent review.
---

# Review

## Non-Negotiable Review Law

One reviewer performs every review in this skill from scratch over the entire declared surface. Do not spawn a subagent, delegate a concern, or load the discussion skill. The [commit early-warning pass](#commit-early-warning-pass) is not a review under this skill and is the sole read-only subagent a solo campaign author may run alongside implementation.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every review decision. A review's duration, difficulty, and consequence surface are reasons to inspect more deeply, never reasons to pass over a sound improvement, accept an unsupported claim, or lower the completion standard.

A complete round must satisfy all four rules:

- **Whole surface:** read every changed file and hunk. For issue discovery, audit the entire campaign scope. Never partition by file, package, concern, platform, or round.
- **Consequence surface:** inspect affected code paths, tests, rendered output, CI, packaging, documentation, and consumers. Trace side effects, state transitions, determinism, numeric and quaternion behavior, Windows and POSIX behavior, public API and MCP-surface compatibility, boundaries, and failure and recovery paths beyond the named symptom or diff.
- **Fresh start:** use the current state and repeat the whole inspection. Earlier rounds, sampled files, and a recheck of only the latest fix do not count as coverage.
- **Unlimited rounds:** whenever the reviewer applies an improvement or accepts a meaningful issue candidate, update the work and start another complete round. Stop only after a complete round produces nothing that survives verification.

## Self-Review

Self-Review and an unqualified review request use this solo workflow:

1. Establish the complete change surface, including the pull request base-to-head diff and any uncommitted changes.
2. Perform one complete round under the Non-Negotiable Review Law. Include correctness and boundaries, numeric and quaternion behavior, determinism, Windows and POSIX behavior, state, public API and MCP-surface compatibility, test isolation and the 100% coverage mandate, CI and packaging, documentation and the `.wiki`, and the viewer-verification skill for anything visual.
3. Reproduce every suspected defect before accepting it.
4. Apply every sound improvement and run the narrowest verification authorized by the owning workflow.
5. If anything changed, restart at step 1 as a fresh full round.
6. Finish only when a complete round finds nothing to improve. Report the final clean round and every verification that could not run.

Self-Review does not authorize creating, pushing, updating, or merging a pull request. Those actions follow the pull-request skill's own authorization rules.

## Commit Early-Warning Pass

A commit early-warning pass is not a review under this skill. It is the read-only per-commit reader a solo campaign author may run while still implementing, defined by the [solo campaign development document](../issue-campaign/development.md#implement-and-write-tests).

It delegates nothing the Non-Negotiable Review Law governs. The law governs the author's own round, which still runs alone over the whole surface before merge under all four rules. One commit is not a declared surface, a reported candidate is not an accepted finding, and the passes do not add up to a round.

Never call the pass a Self-Review, and never report it as one. A reader who sees that name concludes the gate already ran, and the whole-surface round disappears without anyone deciding to drop it.

## Solo Issue Discovery Rounds

Use these rounds only through the solo issue-campaign or benchmark-campaign skill.

1. Audit the entire declared campaign scope yourself. Inspect source, tests, documentation, CI, packaging, rendered output, platform behavior, sibling-repository and upstream provenance, and open and closed issue or pull-request history. Audit the current implementation and history against the development skill's **Forbidden** section. A verified violation remains meaningful even when tests pass and coverage reads 100%.
2. Record every raw candidate and its evidence in the campaign knowledge base before adjudication. Do not silently discard a suspicion because it looks duplicative or inconvenient.
3. Reopen each candidate from primary evidence, reproduce it, verify ownership and provenance, trace its complete consequence surface, and prove any claimed **Forbidden** classification from purpose, control flow, consequence, and history.
4. Record accept, partial acceptance, rewrite, combine, split, reject, or defer. Keep the disposition and reason in the knowledge base so later passes do not rediscover a rejected premise as new.
5. Publish only the surviving adjudicated form when the campaign is authorized to publish.
6. If any meaningful candidate survives, finish the authorized issue and implementation flow, then begin another fresh full-scope round over the integrated state.
7. End discovery only when one complete fresh round over the entire scope produces no meaningful candidate after fact-checking.

An unresolved accepted issue, external blocker, or incomplete implementation prevents a successful campaign conclusion. Report it as blocked or active rather than treating it as a clean round.

## Explicit Multi-Agent Reviews

When the user explicitly asks for a team, parallel, or multi-agent review, load the [multi-agent skill](../multi-agent/SKILL.md) and its review procedure instead of this workflow. It inherits the same whole-surface and fresh-round law while defining independent parallel reviewers and lead adjudication.
