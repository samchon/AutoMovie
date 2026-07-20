---
name: issue-campaign
description: Defines repository-wide issue discovery, lead-vetted issue publication, batched implementation pull requests, and campaign closure for automovie (the conquest loop). Use when the user asks for a broad audit, many issue candidates, or a repeated issue-to-pull-request campaign; do not use for one already-defined issue or an ordinary pull request.
---

# Issue Campaign

An issue campaign is a repeatable sequence of exhaustive discovery, issue publication, implementation pull requests, and campaign closure (the conquest loop): conquer every open ticket, then review the whole surface, surface new issues, and continue. The user's requested phase boundary controls how far to proceed; do not infer permission to publish issues, push branches, open pull requests, or merge from an audit-only request. A standing autonomous mandate (see the pull-request skill) is the exception: it authorizes the full loop end to end.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every admission, disposition, implementation, and review decision in the campaign. A campaign's scale, duration, and blast radius demand stronger evidence and deeper consequence analysis; they never justify admitting an unverified candidate or accepting a weaker implementation or review standard.

Read the project, development, and review skills before starting, and require every discovery-agent brief to do the same. Use the review skill's Issue Discovery Rounds; issue discovery is independent review, not discussion.

## Campaign Knowledge Base

Create `.wiki/08-campaigns/<campaign>/` with a short filesystem-safe campaign name. Preserve any existing campaign directory and reconcile it rather than deleting or assuming a blank slate. Like the rest of the `.wiki/`, campaign notes are written in Korean.

Keep concise, current Markdown documents for:

- the campaign scope, architecture and ownership boundaries, and provenance notes;
- experiments, reproductions, and related issue or pull-request history;
- candidates, evidence, dependencies, and lead disposition;
- implementation batches, their pull requests, and verification records when those phases apply.

The knowledge base supports the campaign but is not the final issue body. A published issue must stand alone without access to `.wiki`: the wiki is gitignored and never visible to a fresh implementer.

## Discover Issues

Run the review skill's Issue Discovery Rounds over the entire declared campaign scope. Every agent independently audits the whole surface in every round. Never divide it by package, file, concern, platform, candidate class, agent, or round.

Source is only one evidence layer. Exercise real workflows: drive the MCP tools, render through the viewer (viewer-verification skill), run the coverage gate. Inspect relevant upstream behavior, history, consumers, fixtures, and public documentation.

Treat the development skill's **Forbidden** section as an explicit retrospective audit contract, not only a rule for future changes. In every complete round, inspect the current implementation and its history for violations, including code that predates the campaign or passes every test at 100% coverage. A verified violation is a meaningful issue candidate. Prove the classification from purpose, control flow, consequence, and history; resemblance or stylistic preference alone is not evidence.

Discovery ends only when a complete round from every agent produces no meaningful candidate that survives lead verification.

## Vet And Publish Issues

The lead, not a discovery agent, owns every publication decision. For each candidate:

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
- **Coordination:** dependencies, safe parallelism, exclusions, migration concerns, and related open, closed, accepted, or rejected work.

Use tables for repeated case mappings. Read the rendered issue back and keep its body as the current operative handoff; use comments only for chronology.

## Develop And Repeat The Campaign

Read [development.md](development.md) in full when the user authorizes implementation pull requests or a standing autonomous mandate covers them. It owns dependency-DAG batching, claim pull requests, implementation waves, worktree cleanup, and renewed discovery. Ordinary repository rules stay in force throughout: every commit is formatted, every PR passes the green `build` and `test` (100% coverage) checks, and merges follow the pull-request skill.

An audit or issue-publication-only campaign does not load the implementation procedure.
