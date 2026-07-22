# Multi-Agent Review

Read this document only through the multi-agent skill for an explicitly requested team, parallel, or multi-agent review. The base review skill's Non-Negotiable Review Law still governs every reviewer: one agent performs one complete review of the entire declared surface from scratch.

Do not use this procedure for Self-Review. The author always completes Self-Review alone even when a separate team review is also authorized.

## Bound The Team

Use the smallest team of two or more reviewers that adds meaningful independent evidence. Open a reviewer slot only when it owns one complete independent pass and can run immediately.

Give every reviewer the same complete surface. Different analytical lenses or primary sources are useful, but package, file, concern, platform, or test-lane partitions are forbidden.

## Team Review Cycle

1. Freeze the exact surface and record its base and head.
2. Give each reviewer a self-contained brief containing the objective, complete surface, constraints, evidence locations, required output format, and exact repository instructions and skills to read.
3. Require every reviewer to inspect the full surface independently and report evidence-backed findings directly to the lead. Reviewers do not discuss findings with one another.
4. The lead independently reproduces and validates every proposal against the repository and relevant provenance. Accept, rewrite, combine, partially accept, or reject it according to evidence.
5. Apply every accepted in-scope improvement, complete the authorized verification, and freeze a new exact surface.
6. If anything changed, end the current team and begin another complete cycle. Stop only when one whole team cycle yields no accepted improvement.

## Research Review Round

Use a Research Review Round when the explicitly requested team review needs external primary sources or sibling-repository provenance. The reference study that precedes a major `interface` or `engine` push uses this mode or a user-requested Discussion.

Each reviewer still inspects the complete change surface and relevant sources independently. Agents submit evidence-backed proposals directly to the lead without a discussion phase. External research adds evidence; it does not relax full-surface coverage or the fresh-cycle stop rule. Durable conclusions drawn from `.references/` are promoted into `.wiki/04-domain-research/` or `.wiki/06-architecture/` with the source cited; raw material stays in `.references/`.

## Parallel Issue Discovery Rounds

Use this mode only through the multi-agent issue or benchmark campaign procedure.

1. Give every discovery reviewer the entire declared campaign scope and require AGENTS.md `## Attitude`, the project, development, review, and relevant campaign skills in its brief.
2. Each reviewer independently audits source, tests, documentation, CI, packaging, rendered output, platform behavior, sibling-repository and upstream provenance, and open and closed issue or pull-request history. Audit the development skill's **Forbidden** section as part of the current code and history.
3. Each reviewer records its own evidence-backed raw candidates without seeing or negotiating a shared candidate list.
4. The lead reopens every candidate from primary evidence, reproduces it, checks ownership and provenance, traces the consequence surface, and records accept, partial acceptance, rewrite, combine, split, reject, or defer in `.wiki`.
5. If any meaningful candidate survived this round, return to step 1 with a fresh reviewer set over the entire scope at the same repository state. Rounds repeat until one of them adds no meaningful candidate.
6. Take the pool that empty round closes into the authorized campaign cycle.
7. Reopen at step 1 over the integrated state once that cycle merges.
8. End discovery only when every reviewer completes the whole scope and no meaningful candidate survives lead verification.

An unresolved accepted issue or incomplete implementation prevents a successful campaign conclusion.
