# Campaign Development

Read this document in full when the user authorizes implementation pull requests, or when a standing autonomous mandate covers implementation. Also read the repository development, pull-request, and review skills before acting.

Unlike a campaign that must suspend expensive CI, automovie keeps its ordinary gates on for every campaign push: `pnpm run format` before every commit, the green `build` and `test` (100% coverage) checks after every push, and the pull-request skill's check-watching loop. A campaign changes the batching and claiming discipline, not the quality gates.

Two rules govern the whole implementation phase:

- The main checkout stays on `master`, and every batch runs in its own worktree on its own branch. Never switch the main checkout's branch, edit inside it, or run a batch's build or suite there. Work accumulating in the shared checkout is what destroys file ownership between concurrent agents: one agent's mid-edit state breaks another's type-check and can block the suite from running at all.
- No agent idles on a running command. [Keep Working While Commands Run](#keep-working-while-commands-run) is a standing requirement of every phase below, not an optimization.

## Flow

- [Plan And Claim A Pull Request Wave](#plan-and-claim-a-pull-request-wave)
- [Keep Working While Commands Run](#keep-working-while-commands-run)
- [Implement And Revalidate A Batch](#implement-and-revalidate-a-batch)
- [Remove Every Finished Worktree](#remove-every-finished-worktree)
- [Repeat A Campaign Cycle](#repeat-a-campaign-cycle)
- [Close The Campaign](#close-the-campaign)

## Plan And Claim A Pull Request Wave

Build the issue dependency DAG before assigning implementation. Use it to form cohesive batches, not to create one worktree per issue.

Batching follows these rules:

- Group dependency-ready issues when their owned files, change surfaces, and verification are compatible. File ownership, not issue count or topic, is the real constraint on parallelism.
- Run batches concurrently only when their owned file sets are disjoint; serialize batches that overlap or depend on one another.
- Assign one batch to one agent, worktree, branch, and pull request.
- State the ownership boundary in every batch brief: the files that batch owns, and the files each concurrent batch holds. An agent that does not know what another agent is holding cannot avoid it.
- Name this document in every batch brief, so the implementing agent inherits its worktree, ownership, and no-idling rules rather than rediscovering them.
- Split jointly implementable issues only for a concrete dependency, ownership, atomicity, or validation reason. Record that reason in the campaign knowledge base.
- Immediately before claiming a batch, check again for an overlapping implementation pull request or branch.

The agent assigned a batch claims it as its first action, before writing any code:

1. Create one isolated worktree and topic branch from `master`.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch and open a draft pull request that overviews the batch scope and links every batched issue.
4. Record the batch, worktree, branch, issues, owned files, and pull request in the campaign knowledge base.
5. Start `pnpm install` in the worktree asynchronously — a fresh worktree carries no `node_modules`, so its build and suite cannot run until it finishes — and begin the source, consequence-surface, and test-design work at once.

The draft pull request reserves the whole batch before code is written, preventing another agent from starting overlapping work.

## Keep Working While Commands Run

Start every long command asynchronously and continue with work that does not depend on its result. `pnpm install`, builds, the test suite, and the coverage run are background work. Watching a process, polling it with no decision to make, or reserving an agent solely to wait is not campaign work.

The overlap follows the state of the batch. While installation runs, read the admitted issue and the implementation around it, map the consequence surface, and write the implementation and its tests. Once a stable source-and-test snapshot is committed and pushed, launch the narrow package-scoped verification and begin Self-Review at once; a test process may run during review because it does not change the snapshot. When several independent checks are needed, start them together instead of serially discovering that each needs the same environment.

Keep a compact command record — the command, its worktree, the source snapshot, the decision that depends on it, and its final result. Check a running command at a genuine decision boundary, when it exits, or before merge, and never through a sleep loop or a foreground wait that only discovers it is still running. Report every command still in flight, its dependency, and its last observed state when handing work off.

Two boundaries stay strict because overlap would destroy the evidence:

- **A Self-Review round must not race a source change.** Freeze and commit the snapshot before opening the round, then inspect its complete diff while verification runs. If review or a result requires a change, commit the correction and restart from a fresh complete round over the new snapshot.
- **A merge must not precede its evidence.** Every required local result and check must be final before merge, however long the wait costs.

## Implement And Revalidate A Batch

Analyze the full consequence and case surface across every issue in the batch. Follow the repository development skill for implementation, tests, documentation, coverage, and narrow-then-broad local verification; follow the viewer-verification skill for anything visual.

Every edit, build, and suite run for a batch happens inside that batch's worktree, against the files the batch owns. Touching a file another concurrent batch holds is a coordination failure even when the change is correct: report the overlap and let the lead re-cut the batches.

A batch is implementation-complete only when its main logic and the full coverage mandate for the changed behavior are both present. A green happy path is not completion.

An implementation agent may find that an issue is false or too broad. The lead must independently validate that conclusion before changing campaign state:

- For a narrowed issue, record the evidence on the issue and pull-request thread, then update the batch scope.
- For a confirmed-invalid issue, record the evidence and close the issue.
- For an externally blocked issue, name the missing upstream API, release, or state transition and keep the issue open unless the user directs otherwise.
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
