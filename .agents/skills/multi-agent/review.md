# Multi-Agent Review

Read this document only through the multi-agent skill for an explicitly requested team, parallel, or multi-agent review. The base review skill's [Non-Negotiable Review Law](../review/SKILL.md#non-negotiable-review-law) still governs every reviewer: one agent performs one complete review of the entire declared surface from scratch.

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

Use this mode only through the [multi-agent issue campaign procedure](issue-campaign.md).

1. Give every discovery reviewer the entire declared campaign scope and require AGENTS.md `## Attitude`, the project, development, review, and relevant campaign skills in its brief.
2. Each reviewer independently audits source, tests, documentation, CI, packaging, rendered output, platform behavior, sibling-repository and upstream provenance, and open and closed issue or pull-request history. Audit the development skill's [Forbidden](../development/SKILL.md#forbidden) section as part of the current code and history.
3. Each reviewer records its own evidence-backed raw candidates without seeing or negotiating a shared candidate list.
4. The lead reopens every candidate from primary evidence, reproduces it, checks ownership and provenance, traces the consequence surface, and records accept, partial acceptance, rewrite, combine, split, reject, or defer in `.wiki/08-campaigns/<campaign>/`.
5. If any meaningful candidate survived this round, finish adjudicating it, keep publication and implementation closed, end the current discovery team, and begin another complete parallel round with a fresh reviewer set over the entire scope at the same recorded pre-development integrated state.
6. Repeat step 5 without a round limit. Earlier team rounds, candidate rechecks, and sampled areas do not count toward the new round.
7. End the cycle's discovery phase only when every reviewer in one fresh round completes the whole scope and no meaningful candidate survives lead verification. That empty round opens the authorized publication, which covers the whole pool the preceding nonempty rounds accumulated rather than only what the last productive round produced, and hands implementation every implementation-ready issue in it.
8. After the integrated implementation merges, start the next cycle's discovery from the new integrated state. End the campaign only when an empty round leaves no accepted campaign issue unresolved.

The gate that opens implementation is an empty round, not an empty issue set, so implementation begins with every accepted issue the earlier rounds accumulated still unimplemented. Campaign conclusion is the stricter test: an unresolved accepted issue or an incomplete implementation prevents it.
