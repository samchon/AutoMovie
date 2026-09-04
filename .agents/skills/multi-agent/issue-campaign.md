# Multi-Agent Issue Campaign

Read this document only through the multi-agent skill for an explicitly parallel issue campaign. Read the base issue-campaign, project, development, pull-request, review, and [multi-agent review](review.md) procedures before acting.

The base issue-campaign skill owns authorization, the knowledge base, discovery surfaces, candidate adjudication, self-contained issue bodies, and the clean full-scope completion gate. This document overrides only discovery and implementation topology.

## Select The Parallel Boundary

What this document adds is **parallel discovery** and **isolated implementation batches**. The base campaign already implements in parallel, so parallelism alone never selects this document.

A multi-agent issue campaign parallelizes discovery and partitions implementation into per-batch worktrees, branches, and pull requests.

Keep implementation in the base campaign's shared checkout unless the user asked for that isolation. In that mode:

1. Run Parallel Discovery repeatedly against the recorded pre-development integrated state until one complete parallel round is empty. The lead adjudicates every round, and the authorized publication then covers the whole pool those rounds accumulated.
2. Stop every discovery agent only after that empty-round gate passes.
3. If the gate passes with no accepted issue, skip implementation and evaluate [Completion](#completion).
4. Otherwise read the base issue campaign's [development procedure](../issue-campaign/development.md).
5. Partition every implementation-ready issue into frozen coarse batches, then create each ready batch's isolated worktree, branch, and empty-claim pull request in dependency-DAG waves. Dispatch one owner per batch, complete the locally authorized gates, validate through ordinary CI, and complete the lead's [integration Self-Review](../issue-campaign/development.md#validate-with-ci-and-the-integration-self-review) over the integrated base-to-head diff.
6. Apply that procedure's implementation, CI, merge, branch cleanup, and temporary-asset rules to each batch pull request. Repair every red CI lane in that batch's pull request even when the failure predates the campaign or is unrelated to its original issues, then return here for the next parallel discovery round instead of switching to the base skill's solo discovery.

Do not infer isolated batches from quota concerns, a large issue count, or the fact that several owners implement at once. Only the user's explicit phase boundary selects them.

## Parallel Discovery

Use [review.md](review.md)'s Parallel Issue Discovery Rounds. Every discovery agent audits the whole declared scope independently. The lead alone fact-checks and publishes.

Record the integrated state the rounds run against in `.wiki/08-campaigns/<campaign>/` before the first round, and pool every raw candidate in that same campaign knowledge base. Reproduce and combine, split, rewrite, reject, or defer them before publication. Parallel discovery changes evidence breadth, not publication authority.

Keep implementation closed while any meaningful candidate survives a round. Accumulate accepted issues, end the current discovery team, and run another complete parallel full-scope round against that same recorded pre-development state. Begin implementation only after one complete team round is empty and the accumulated accepted issue set is nonempty.

The repeat-until-empty half of that gate is the base skill's [One Cycle Costs As Many Rounds As It Takes](../issue-campaign/SKILL.md#one-cycle-costs-as-many-rounds-as-it-takes) rule, unchanged. Running agents in parallel widens one round; it does not make one round enough.

## Build Coarse Implementation Batches

When implementation is also parallel, first confirm the empty-round discovery gate and freeze the accumulated accepted issue set. Recompute the published-issue DAG before every wave. Form the smallest number of maximal cohesive batches that dependency readiness and ownership permit.

Group issues only when they are ready on the same frontier, share an architectural owner or root invariant, overlap in consequence surface, use mostly the same verification, and remain understandable and reversible as one diff. Split for a named dependency, external blocker, repository or target-branch boundary, independent release contract, incompatible verification owner, destructive file overlap, or lost issue-level attribution.

Topic, label, package proximity, reporter, and issue count do not justify a split. Record the original issue count, final pull-request count, DAG edges, grouping reasons, split reasons, owned files, and verification lanes in the campaign knowledge base before opening claims.

Freeze a batch once its empty claim pull request exists. Re-cut an active batch only when correctness, overlap, or invalidated evidence requires a lead decision.

Open only as many implementation agents as there are immediately executable, non-overlapping batches.

## Claim And Implement Parallel Batches

For each immediately executable batch:

1. Create one isolated worktree and topic branch.
2. Start `pnpm install` in that worktree asynchronously and continue the claim while it runs. A new worktree carries no `node_modules` of its own, so nothing in it builds, type-checks, or tests until its own install finishes.
3. Create an implementation-free commit with `git commit --allow-empty`.
4. Push and open a draft pull request referencing every batch issue by number and stating its owned files. The [claim rule](../issue-campaign/development.md#claim-the-complete-cycle) applies unchanged: no closing keyword in a body written before the code exists.
5. Record the batch, worktree, branch, issues, owned files, pull request, and verification lanes in the campaign knowledge base.
6. Implement the full consequence surface and the required positive, negative, boundary, and regression coverage. Every executable position the batch writes must reach 100% statements, branches, functions, and lines under the development skill's exact obligation.
7. Run `pnpm run format`, then commit and push coherent increments, each carrying the [commit closing lines](../issue-campaign/development.md#implement-in-parallel) for the issues it earns.
8. Run the narrowest proving command the [development skill's validation rule](../development/SKILL.md#validation) requires, then the broader locally owned lanes: `pnpm --filter @automovie/test start` for the suite and `pnpm --filter @automovie/test coverage` for the changed positions the batch owes.
9. Freeze the head and complete solo Self-Review under the [review skill's law](../review/SKILL.md#non-negotiable-review-law). If code changes, rerun the necessary local gates and restart the full review.
10. Let the lead independently verify issue fit, dispositions, evidence, and batch scope.
11. Read the pull request's CI once per settled head. Diagnose and repair every red lane in that same pull request, even when the failure predates the campaign or is unrelated to its original issues, then commit, push, and restart the required review and CI loop.
12. Merge only with user authorization once the same immutable head carries green required checks, the completed locally authorized verification, the lead's review, the final clean Self-Review, and any red-CI repair.

The repository workflows own supersession through their per-workflow, per-ref `concurrency` groups with `cancel-in-progress`. A new push automatically cancels an older run for the same workflow and ref; never cancel another branch manually, and do not wait on an obsolete head.

Measure each batch from its empty pull request's GitHub `createdAt` through `mergedAt`, including installation, dependency waiting, implementation, validation, review, rebases, cancellation, CI, repair, and merge. Keep outliers and record issue count beside the duration.

Start long local commands asynchronously and continue useful independent work. Do not reserve an agent solely to watch installation, build, test, CI, or cancellation.

When batches overlap unexpectedly, stop the later mutation, report the exact file and invariant conflict, and let the lead serialize or re-cut the work. Agents never edit another batch's owned files.

## Integrated Cleanup

After every parallel implementation batch is resolved and its worktree and external assets are removed:

1. Create one cleanup worktree and topic branch from the integrated target.
2. Install its dependencies with `pnpm install`, then run `pnpm run format`.
3. Run the full integrated local validation the project and development skills require, including `pnpm run build` and `pnpm --filter @automovie/test coverage`.
4. If formatting or integration validation changes files, open one ordinary cleanup pull request, let all CI checks run, and complete solo Self-Review while they run.
5. Repair every CI or review finding in the same cleanup pull request, including a red lane unrelated to the campaign's original changes, and repeat until the same head is green and clean.
6. Merge with authorization, then remove the cleanup worktree, branch, and assignment-owned external assets.
7. If integration produces no diff, complete solo Self-Review over the integrated target, then remove the unused cleanup worktree and branch without opening a pull request.

## Completion

After the selected implementation flow is resolved, reopen Parallel Discovery against the integrated repository. Repeat complete parallel full-scope rounds against that state until one full team round is empty, accumulating every accepted issue before any new implementation begins.

When the gate instead passed with no accepted issue to implement, no new integrated state exists to re-audit. Finish the remaining cleanup and evaluate the conditions below directly rather than reopening discovery against the state that just came up empty.

The campaign succeeds only when every reviewer completes the whole scope, no meaningful candidate survives lead verification, no accepted issue remains unresolved, and every campaign worktree and assignment-owned temporary asset is removed. Report an external blocker as blocked, not complete.
