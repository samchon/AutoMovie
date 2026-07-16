# Campaign Development

Read this document in full when the user authorizes implementation pull requests, or when a standing autonomous mandate covers implementation. Also read the repository development, pull-request, and review skills before acting.

Unlike a campaign that must suspend expensive CI, automovie keeps its ordinary gates on for every campaign push: `pnpm run format` before every commit, the green `build` and `test` (100% coverage) checks after every push, and the pull-request skill's check-watching loop. A campaign changes the batching and claiming discipline, not the quality gates.

## Flow

- [Plan And Claim A Pull Request Wave](#plan-and-claim-a-pull-request-wave)
- [Implement And Revalidate A Batch](#implement-and-revalidate-a-batch)
- [Remove Every Finished Worktree](#remove-every-finished-worktree)
- [Repeat A Campaign Cycle](#repeat-a-campaign-cycle)
- [Close The Campaign](#close-the-campaign)

## Plan And Claim A Pull Request Wave

Build the issue dependency DAG before assigning implementation. Use it to form cohesive batches, not to create one worktree per issue.

Batching follows these rules:

- Group dependency-ready issues when their change surfaces and verification are compatible.
- Assign one batch to one agent, worktree, branch, and pull request.
- Split jointly implementable issues only for a concrete dependency, ownership, atomicity, or validation reason. Record that reason in the campaign knowledge base.
- Immediately before claiming a batch, check again for an overlapping implementation pull request or branch.

The agent assigned a batch claims it as its first action, before writing any code:

1. Create one isolated worktree and topic branch from `master`.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch and open a draft pull request that overviews the batch scope and links every batched issue.
4. Record the batch, worktree, branch, issues, and pull request in the campaign knowledge base.

The draft pull request reserves the whole batch before code is written, preventing another agent from starting overlapping work.

## Implement And Revalidate A Batch

Analyze the full consequence and case surface across every issue in the batch. Follow the repository development skill for implementation, tests, documentation, coverage, and narrow-then-broad local verification; follow the viewer-verification skill for anything visual.

An implementation agent may find that an issue is false or too broad. The lead must independently validate that conclusion before changing campaign state:

- For a narrowed issue, record the evidence on the issue and pull-request thread, then update the batch scope.
- For a confirmed-invalid issue, record the evidence and close the issue.
- If no issue remains in the batch, close the claim pull request instead of leaving an orphan reservation.

Commit and push every coherent implementation increment to the claimed branch, then watch the checks per the pull-request skill; do not hold a completed implementation locally until handoff or continue past a red check.

Before merge, complete solo Self-Review under the review skill, opening each round by commenting its findings and remediation plan on the pull request before acting on them so the thread records why every follow-up change happened. Merging follows the pull-request skill: on explicit user request, or under a standing autonomous mandate once Self-Review and every required check pass.

## Remove Every Finished Worktree

Worktree removal is part of finishing an assignment, not optional housekeeping.

After a pull request merges:

1. Verify GitHub records it as merged into the intended target.
2. Confirm the worktree has no unpushed or uncommitted work worth preserving.
3. Run `git worktree remove --force <path>` so ignored build artifacts are deleted too.
4. Verify the directory no longer exists.
5. Run `git worktree prune` and delete the local topic branch.
6. Confirm `git worktree list --porcelain` contains no record of the removed path.

If an assignment ends without a merge, first record retained evidence and confirm the remaining contents are disposable. Then remove its worktree and local branch by the same standard. Do not mark an assignment complete while its worktree remains on disk.

## Repeat A Campaign Cycle

Report the wave after every surviving issue is covered by its assigned batch pull request.

When the user requests another discovery cycle — or the standing autonomous mandate's loop continues — return to the parent skill's Discover Issues phase and start new unlimited full rounds over the entire campaign scope. Earlier rounds are not coverage.

## Close The Campaign

Run this phase only after the campaign ends, every campaign pull request is resolved, and every campaign worktree is removed.

1. Return to `master` in the main checkout and confirm it contains no unrelated user changes.
2. Pull the final campaign result with `git pull --ff-only origin master`.
3. Require the main checkout to be clean and `git worktree list --porcelain` to show only the main checkout.
4. Update the campaign knowledge base with the final disposition of every issue and pull request, and fold durable findings into the permanent `.wiki/` sections.
