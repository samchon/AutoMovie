---
name: multi-agent
description: Defines the isolated-topology variants of automovie review and issue campaigns: parallel discovery, parallel review, and implementation partitioned into separate worktrees, branches, and pull requests. Use only when the user explicitly requests a team, parallel, or multi-agent review or campaign. Ordinary campaigns already implement in parallel inside one checkout and one branch and do not need this skill; route those to the issue-campaign skill.
---

# Multi-Agent Workflows

This skill covers only the topologies the ordinary workflows do not use.

Parallel implementation by itself is not one of them. The [issue-campaign skill](../issue-campaign/SKILL.md) already dispatches one owner per issue in dependency-DAG waves, all sharing one checkout and one branch, and that is the ordinary campaign shape. Read this skill only when the user asks for something it does not do:

- discovery split across agents;
- review split across agents;
- implementation partitioned into separate worktrees, branches, or pull requests.

Read the base skill first, then enter through the detailed document below for the requested workflow. That document names any shared multi-agent topic procedures it also requires.

| Explicit request | Base skill | Detailed multi-agent procedure |
| --- | --- | --- |
| Team, parallel, or multi-agent review | [review](../review/SKILL.md) | [review.md](review.md) |
| Parallel or multi-agent issue campaign | [issue-campaign](../issue-campaign/SKILL.md) | [issue-campaign.md](issue-campaign.md) |

Do not load this skill for Self-Review, an unqualified review, or a campaign that does not explicitly request parallel agents.

## Shared Parallelism Rules

- Use the smallest number of agents that adds independent evidence or owns immediately executable disjoint work. Available thread capacity is not a reason to create an agent.
- Never create a waiter, poller, coordinator-only child, duplicate implementation owner, or agent that cannot begin useful work immediately.
- Give every review or discovery agent the complete declared surface. Parallel review adds independent full passes; it never partitions coverage by package, file, concern, platform, or test lane.
- Partition implementation only through verified dependency and file-ownership boundaries. One agent owns one coarse batch, branch, pull request, and worktree.
- Keep the lead active on fact-checking, integration, conflict resolution, and decisions that do not duplicate an assigned agent.
- Do not let agents re-delegate.
- One reviewer covers one whole declared surface, and Self-Review stays solo for every author and every implementation branch. A campaign's issue owners each review their own issue and the lead reviews the integrated diff; no surface is ever split across agents.
- Create worktrees only when the user asked for isolated implementation batches, plus the one integrated cleanup worktree those batches end in. Ordinary campaigns, ordinary pull requests, and every Self-Review use the current checkout and one topic branch.
- Remove every finished worktree, local branch, process, and assignment-owned temporary asset before declaring its assignment complete.

The user's phase boundary controls the topology. A multi-agent issue campaign adds parallel discovery to the parallel implementation the ordinary campaign already performs, and isolates that implementation into per-batch worktrees, branches, and pull requests. When the user wants parallel implementation without that isolation, the ordinary [issue-campaign](../issue-campaign/SKILL.md) workflow is already the answer.
