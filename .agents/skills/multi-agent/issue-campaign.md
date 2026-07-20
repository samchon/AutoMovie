# Multi-Agent Issue Campaign

Read this document only through the multi-agent skill for an explicitly parallel issue campaign. Read the base issue-campaign, project, development, pull-request, review, and [multi-agent review](review.md) procedures before acting.

The base issue-campaign skill owns authorization, the knowledge base, discovery surfaces, candidate adjudication, self-contained issue bodies, and the clean full-scope completion gate. This document overrides only discovery and implementation topology.

## Select The Parallel Boundary

A multi-agent issue campaign parallelizes both discovery and implementation by default.

Switch to parallel discovery with solo implementation only when the user explicitly requests that combination. In that mode:

1. Run Parallel Discovery and let the lead complete candidate adjudication and authorized publication.
2. Stop every discovery agent before implementation begins.
3. Read the base issue campaign's [solo development procedure](../issue-campaign/development.md).
4. Put every implementation-ready issue into its one empty-claim pull request, use the current checkout without a clone or worktree, complete the local gates, validate through ordinary CI, and complete solo Self-Review while CI runs.
5. Repair every red CI lane in that same pull request, commit and push the repair even when the failure predates the campaign or is unrelated to its original issues, then return here for the next parallel discovery round.

Do not infer solo implementation from quota concerns, a small issue count, or the fact that the lead performs publication. Only the user's explicit phase boundary selects it.

## Parallel Discovery

Use [review.md](review.md)'s Parallel Issue Discovery Rounds. Every discovery agent audits the whole declared scope independently. The lead alone fact-checks and publishes.

Pool raw candidates in `.wiki`, then reproduce and combine, split, rewrite, reject, or defer them before publication. Parallel discovery changes evidence breadth, not publication authority.

## Build Coarse Implementation Batches

When implementation is also parallel, recompute the published-issue DAG before every wave. Form the smallest number of maximal cohesive batches that dependency readiness and ownership permit.

Group issues when they are ready on the same frontier, share an architectural owner or root invariant, overlap in consequence surface, use mostly the same verification, and remain understandable and reversible as one diff. Split only for a named dependency, external blocker, repository or target-branch boundary, independent release contract, incompatible verification owner, destructive file overlap, or lost issue-level attribution.

Topic, label, package proximity, reporter, and issue count do not justify a split. Record the original issue count, final pull-request count, DAG edges, grouping reasons, split reasons, owned files, and verification lanes in `.wiki` before opening claims.

Freeze a batch once its empty claim pull request exists. Re-cut an active batch only when correctness, overlap, or invalidated evidence requires a lead decision.

Open only as many implementation agents as there are immediately executable, non-overlapping batches.

## Claim And Implement Parallel Batches

For each immediately executable batch:

1. Create one isolated worktree and topic branch.
2. Create an implementation-free commit with `git commit --allow-empty`.
3. Push and open a draft pull request linking every batch issue and stating its owned files.
4. Record the batch, worktree, branch, issues, owned files, and pull request in the campaign knowledge base.
5. Implement the full consequence surface and the required positive, negative, boundary, and regression coverage. Run `pnpm run format`, then commit and push coherent increments.
6. Run the narrowest local proving commands followed by the broader locally owned lanes. Freeze the head and complete solo Self-Review. If code changes, rerun the necessary local gates and restart the full review.
7. Watch the pull request's CI. Repair every red lane in this same pull request, even when the failure predates the campaign or is unrelated to its original issues, then commit, push, and restart the required review and CI loop.
8. Let the lead independently verify issue fit, dispositions, evidence, and batch scope. Merge only with user authorization after the required checks and final clean Self-Review are complete.

Measure each batch from its empty pull request's GitHub `createdAt` through `mergedAt`, including installation, implementation, validation, review, rebases, CI, repair, and merge. Keep outliers and record issue count beside the duration.

When batches overlap unexpectedly, stop the later mutation, report the exact file and invariant conflict, and let the lead serialize or re-cut the work. Agents never edit another batch's owned files.

## Integrated Cleanup

After every parallel implementation batch is resolved and its worktree and external assets are removed:

1. Create one cleanup worktree and topic branch from the integrated target.
2. Run `pnpm run format` and the full integrated local validation required by the project and development skills.
3. If formatting or integration validation changes files, open one ordinary cleanup pull request and complete solo Self-Review while its CI runs.
4. Repair every CI or review finding in the same cleanup pull request, including a red lane unrelated to the campaign's original changes, and repeat until the same head is green and clean.
5. Merge with authorization, then remove the cleanup worktree, branch, and assignment-owned external assets.
6. If integration produces no diff, complete solo Self-Review over the integrated target, then remove the unused cleanup worktree and branch without opening a pull request.

## Completion

After the selected implementation flow is resolved, run another complete parallel full-scope discovery round against the integrated repository.

The campaign succeeds only when every reviewer completes the whole scope, no meaningful candidate survives lead verification, no accepted issue remains unresolved, and every campaign worktree and assignment-owned temporary asset is removed. Report an external blocker as blocked, not complete.
