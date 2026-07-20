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

Recompute the published-issue dependency DAG after publication and before every implementation wave. A published issue is an evidence and acceptance unit, not a default pull-request boundary. Form the smallest number of maximal cohesive batches that the verified dependencies and implementation surfaces permit.

Admit two or more published, unclaimed, dependency-ready issues to one batch only when every row below supports the same implementation unit:

| Decision axis | Group when | Split when |
| --- | --- | --- |
| Dependency readiness | Every issue is ready on the same DAG frontier and the batch can finish without waiting for another member or an external state transition. | An issue has a different prerequisite, external blocker, release gate, or target-branch timing. |
| Architectural ownership and root cause | The issues repair the same verified root cause or closely coupled invariants under one architectural owner. | They belong to different repositories, target branches, product owners, or independently releasable contracts. |
| Change and consequence surface | The owned files overlap, must move together, or form one traceable consequence surface. Disjoint files may still group when one invariant requires all of them. | The changes can land and roll back independently without leaving either issue incomplete. |
| Verification | The issues share most setup, focused harnesses, rendered evidence, and broad validation lanes. | They require materially different environments, validation owners, or merge gates, or one failure would unnecessarily block the others. |
| Atomicity and review | One diff can keep every issue's acceptance matrix explicit and can be reviewed, reverted, and diagnosed as one coherent change. | Combining them obscures root cause, issue-level acceptance, rollback, or failure attribution. |

Topic, label, package proximity, reporter, and issue count do not justify a batch by themselves. File disjointness does not require a split when the same root cause and verification lane bind the files, and file overlap does not justify grouping issues with different readiness or atomicity.

Build each wave in this order:

1. Take every published, admitted, unclaimed node on the current dependency frontier.
2. Partition the nodes by architectural owner and verified root cause.
3. Merge partitions that share a change and consequence surface and most verification work while preserving issue-level acceptance and rollback.
4. Split only for a named dependency, ownership, atomicity, or validation reason from the table.
5. Check open pull requests and remote branches for overlapping implementation immediately before claiming.
6. Freeze the batch once its empty claim pull request exists. Do not add a newly published issue to an active claim or close, move, or combine an active claim merely to improve batching or throughput statistics. Change an active claim only when correctness, overlap, or invalidated evidence requires a lead decision.

Run batches concurrently only when their owned file sets are disjoint; serialize batches that overlap or depend on one another. Assign one batch to one agent, worktree, branch, and pull request.

State the ownership boundary in every batch brief: the files that batch owns, and the files each concurrent batch holds. Name this document in the brief so the implementing agent inherits its worktree, ownership, batching, and no-idling rules rather than rediscovering them.

Record the DAG edges, the issues in each batch, the owned change and consequence surfaces, the shared verification lane, every grouping reason, and every split reason in the campaign knowledge base. Report the pull-request unit count before batching and after batching before opening claims.

The agent assigned a batch claims it as its first action, before writing any code:

1. Create one isolated worktree and topic branch from `master`.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch and open a draft pull request that overviews the batch scope and links every batched issue.
4. Record the batch, worktree, branch, issues, owned files, and pull request in the campaign knowledge base.
5. Start `pnpm install` in the worktree asynchronously (a fresh worktree carries no `node_modules`, so its build and suite cannot run until it finishes) and begin the source, consequence-surface, and test-design work at once.

The draft pull request reserves the whole batch before code is written, preventing another agent from starting overlapping work.

Measure the official duration of a claimed batch from the empty claim pull request's GitHub `createdAt` timestamp through its `mergedAt` timestamp. Use the GitHub fields, not a local clock or commit timestamp. The duration includes installation, implementation, validation, review, dependency waiting, rebases, CI, and merge. Record the issue count beside the duration so batch density remains visible, and do not remove outliers or replace the official per-pull-request measure with a commit-to-merge or per-issue metric.

## Keep Working While Commands Run

Start every long command asynchronously and continue with work that does not depend on its result. `pnpm install`, builds, the test suite, and the coverage run are background work. Watching a process, polling it with no decision to make, or reserving an agent solely to wait is not campaign work.

The overlap follows the state of the batch. While installation runs, read the admitted issue and the implementation around it, map the consequence surface, and write the implementation and its tests. Once a stable source-and-test snapshot is committed and pushed, launch the narrow package-scoped verification and begin Self-Review at once; a test process may run during review because it does not change the snapshot. When several independent checks are needed, start them together instead of serially discovering that each needs the same environment.

Keep a compact command record: the command, its worktree, the source snapshot, the decision that depends on it, and its final result. Check a running command at a genuine decision boundary, when it exits, or before merge, and never through a sleep loop or a foreground wait that only discovers it is still running. Report every command still in flight, its dependency, and its last observed state when handing work off.

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

When the user requests another discovery cycle (or the standing autonomous mandate's loop continues), return to the parent skill's Discover Issues phase and start new unlimited full rounds over the entire campaign scope. Earlier rounds are not coverage.

## Close The Campaign

Run this phase only after the campaign ends, every campaign pull request is resolved, and every campaign worktree is removed.

1. Return to `master` in the main checkout and confirm it contains no unrelated user changes.
2. Pull the final campaign result with `git pull --ff-only origin master`.
3. Require the main checkout to be clean and `git worktree list --porcelain` to show only the main checkout.
4. Update the campaign knowledge base with the final disposition of every issue and pull request, and fold durable findings into the permanent `.wiki/` sections.
