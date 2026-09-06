# Campaign Development

Read this document in full when the user authorizes implementation pull requests or the end of an issue campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Plan One Cycle Pull Request](#plan-one-cycle-pull-request)
- [Claim The Complete Cycle](#claim-the-complete-cycle)
- [Fix Path Ownership Before Dispatch](#fix-path-ownership-before-dispatch)
- [Implement In Parallel](#implement-in-parallel)
- [Integrate What Each Owner Hands Back](#integrate-what-each-owner-hands-back)
- [Validate With CI And The Integration Self-Review](#validate-with-ci-and-the-integration-self-review)
- [Merge And Clean Up](#merge-and-clean-up)
- [Repeat Until A Clean Round](#repeat-until-a-clean-round)

Five rules govern the implementation phase:

- Discovery, adjudication, and publication stay with the main agent. Implementation is parallel: one issue owner per accepted issue, all working the same checkout and the same branch.
- Put every accepted, implementation-ready issue in the current cycle into one pull request. The issue DAG controls dispatch order and integration order inside that pull request, not pull-request count.
- Use the current checkout and one topic branch. Do not create a clone, a worktree, a per-owner branch, or a per-owner pull request.
- Every owner Self-Reviews its own surface before reporting. The main agent then runs one integration Self-Review over the whole base-to-head diff. The second never inherits the first.
- The pull request's ordinary CI and a clean integration Self-Review are the acceptance gates, and both must land on the same immutable head. Repair every red CI lane in that same pull request, even when the failure predates the campaign or is unrelated to its original issues.

## Plan One Cycle Pull Request

Recompute the published-issue dependency DAG after publication. The DAG does two jobs here: it decides which issues may be implemented at the same time, and it decides the order in which the main agent wires their results together.

Build the cycle scope in this order:

1. Reopen every published, unclaimed issue and verify it still belongs to this repository and campaign.
2. Remove only issues proved duplicate, invalid, out of scope, or externally blocked, and record the exact disposition. An accepted unresolved issue prevents campaign completion.
3. Check open pull requests and remote branches for overlapping work before claiming.
4. Put every remaining issue into one cycle ledger with its acceptance matrix, consequence surface, affected files, and DAG predecessors.
5. Group the ledger into dependency waves: a wave is the set of issues whose predecessors are all already integrated.

Different packages, invariants, or validation lanes do not split the cycle. Keep issue-level commits, but the pull request remains the integrated campaign unit.

Difficulty never removes an issue from the cycle. When a resolution needs a judgment call about design, invariant ownership, or an acceptable behavior change, settle it from the issue's evidence and implement that decision inside the cycle. A proved duplicate, an invalid premise, an out-of-scope finding, and an external blocker remain the only dispositions that remove one.

### Waves, Not A Single Fan-Out

Dispatch a wave at a time. An issue whose types, ids, or graph another issue is still reshaping cannot be implemented against them: its owner would build on a surface that changes underneath, and the rework is guaranteed rather than possible.

Every owner may begin investigation and independent module design immediately. What the DAG orders is integration, and integration is what the main agent controls by choosing when to dispatch.

Hold a later wave until the surface it builds on has settled, then dispatch it with the settled facts written into its brief: what landed, what the earlier owner refused to do and why, and which limits are now recorded as issues rather than defects.

## Claim The Complete Cycle

Claim the whole cycle before dispatching any owner:

1. Use the current clean repository checkout, switch to the target branch, update it with `git pull --ff-only`, and create one topic branch. Do not create a clone or worktree.
2. Create one implementation-free commit with `git commit --allow-empty`.
3. Push the branch and open one draft pull request.
4. Reference every cycle issue by number, mark verification pending, and state that the pull request owns the complete accepted cycle.
5. Record the checkout, branch, pull request, head SHA, issue set, wave grouping, path ownership, and external temporary-asset ledger in `.wiki`.

Keep every closing keyword out of the claim body. The body is written before any code exists, so a claim-time `Closes #n` list closes whatever the cycle later drops, defers, narrows, or disproves, burying the analysis those issues carry. The cycle's closing set is the union of the [commit closing lines](#implement-in-parallel), which makes the merge close exactly what landed.

## Fix Path Ownership Before Dispatch

Parallel owners in one checkout collide on shared files, not on their own. Decide ownership before the first owner starts, and write it into the campaign ledger.

**Each issue owner owns its own source, test, and document files.** It edits nothing else.

**The main agent owns every integration surface alone.** At minimum that is: package barrel `index.ts` files, the production compiler and its sandbox, materialization and design validation, the source-link export contract, the authoring interface, the scaffold viewer runtime and loader, the compiler's own test file, the pull-request body, and CI repair.

An owner that needs a change in an integration file finishes its own module and tests first, then hands the main agent the exact insertion point, call signature, and literal source. It does not edit the file itself. The main agent applies it, because one reader holding the whole picture is what keeps two owners from wiring contradictory things into the same function.

When an owner finishes, its files become unowned. Assign them explicitly to whoever's consequence surface reaches them next, rather than leaving them for whoever notices.

### Vertical Scope Is Not Path Ownership

An issue's [vertical scope](SKILL.md#an-issue-stands-vertically) and this section's path ownership answer different questions. Vertical scope says which layers the issue is accountable for; path ownership says who types into which file. An owner is routinely accountable for a layer it may not edit.

The sandbox engine surface is the standard case. A capability an authoring agent has to call belongs on that surface and the issue does not close until it is there, while the file itself falls under "the production compiler and its sandbox" in the list above and stays with the main agent. The owner builds and tests the capability, then hands over the exact entry, and the main agent applies it.

Vertical scope therefore produces more hand-offs; it never authorizes editing an integration file. An owner that finishes its module and leaves the surface entry, the barrel, or the guide sentence to whoever notices has manufactured the exact "capability exists and cannot be reached" defect the vertical contract was written to prevent. Reporting that module as the issue done is the placeholder report [Honest Reporting Is Part Of The Work](#honest-reporting-is-part-of-the-work) forbids.

Contract documents and authoring skills are assigned per file, the same way source is. `docs/requirements`, `docs/specifications`, and the shipped authoring skill hold one file per topic, so two issues usually write different files; a document two issues both need is an integration surface and the main agent owns it. Settle that in the ledger before dispatch rather than at the first collision.

## Implement In Parallel

Dispatch one owner per issue in the current wave. Give each owner its issue, the campaign handover, the skills it needs, the settled facts from earlier waves, and its exact path ownership.

Every owner:

1. Implements its issue across every layer the issue's **Scope** section names, tracing the full consequence surface rather than the reported witness. A layer that lands in an integration file is handed over, not edited.
2. Leaves every executable position it wrote at 100% statements, branches, functions, and lines, by testing rather than by hiding code. The obligation is per change; the repository total carries inherited gaps in files nobody touched, and an owner neither inherits those nor reports the total as its own result.
3. Runs a complete solo Self-Review over its own surface under the [review skill's law](../review/SKILL.md#non-negotiable-review-law), repeating full rounds until one finds nothing.
4. Runs `pnpm run format`, commits its own paths, and pushes.
5. Reports what is closed, what is not, its commit SHAs, the integration wiring it needs, its coverage numbers, and every verification it could not run.

### Committing From A Shared Checkout

- Stage explicit paths: `git commit --only <owned paths>`. **Never `git add -A`** and never `git commit -a`; another owner's half-written file is always in the tree.
- Retry the same command after a moment when the git index lock collides.
- End the message body with `Refs #n` while the issue is in flight. Use `Close #n: <issue title>` only from the commit that actually earns the acceptance, as its own paragraph before the `Co-Authored-By` trailer.
- Never run `git reset --hard`, `git checkout --`, `git restore`, `git clean`, or `git stash`. Every one of them destroys work an owner has not committed yet.
- Never rebase or force-push a branch other owners are committing onto.

### What A Shared Checkout Actually Costs

State these to every owner up front, because each one has already cost a cycle:

- **The tree type-breaks constantly.** The suite type-checks the whole project before running anything, so one owner's in-flight error blocks every owner's tests. Report the blocking file and its error to the main agent rather than editing someone else's file, and expect to be blocked in return.
- **Never narrow the type-check to your own files to get past that.** A `tsconfig` that includes only the fold you own passes while your change is breaking a file you excluded, which is the exact failure the whole-project check exists to catch: widening a union or making a field optional is a claim about every consumer, and the consumers are usually in files you do not own. Coverage measured through a narrowed harness is wrong for the same reason, and has already reported a known-100% file at 94.73%. Wait for the tree, or report the blocker and work on something else. If a scratch config is unavoidable for one diagnostic, delete it in the same turn and re-measure through the repository's own command before reporting any number from it.
- **A local build is not proof for a commit.** Wiring that references a file another owner has not committed yet compiles locally and fails in CI. Verify the target is tracked, not merely present.
- **Emitted artifacts are not source, and a stale one can disarm a transform rather than merely shadow a module.** Running the type-checker without `--noEmit` drops output beside every `.ts`, and the loader then prefers it. One cycle left 210 such files under `packages/*/src`; they were gitignored, so `git status` said nothing and the tracked zero-JavaScript scan stayed green. The emitted `AutoMovieProductionCompiler.js` was 329 KB where the properly built `lib` file is 2.99 MB, because plain `tsc` produced it without `ttsc`'s typia transform, so every `typia.validateEquals` in that package became the "no transform has been configured" stub. Scenarios that had passed twenty minutes earlier began failing several modules from the cause, including one that predated the work being done. Read that consequence rather than the file count: this one degraded to throwing, and a variant that degraded to accepting everything would have taken the suite green with no validation running at all. Type-check with the repository's own command, never run an entry from outside a project root, and when a scenario starts failing in a package you did not touch, look for emitted output beside its sources before you look at its logic.
- **A structural guard re-pins from its own failure.** Read the reported actual value at its own key and replace the expected value at that key. Picking a digest out of the surrounding output in the order it appears writes a real value into the wrong field and produces a guard that passes while measuring nothing.
- **Write escapes, not control characters.** A literal NUL in a template literal runs correctly and makes the file binary to `grep` and diff, so it silently drops out of content searches and is invisible in review.
- **Match the shell.** A here-string spelling from one shell passed to another is taken literally and lands as the commit subject.

### Honest Reporting Is Part Of The Work

An owner reports what it proved, not what it built. A type existing is not a feature, a data structure is not a simulation, and a defined cache is not a lifecycle. An analysis that is unsupported or was not executed is reported as such, never as a success.

An owner that finds its issue only partially closable says so and names the boundary. The main agent decides the disposition; an owner that quietly reports a placeholder as done removes that decision from the campaign.

## Integrate What Each Owner Hands Back

Verify each hand-off before applying it. An owner's proposed patch is a hypothesis about a file it could not compile in place, and today's cycle has already seen one that named a symbol the target file does not resolve.

For each report:

1. Reproduce the claim from primary evidence. Read the actual code at the insertion point rather than trusting the quoted context.
2. Apply the wiring, build the affected packages, and run the narrowest proving command.
3. Record in the commit message what was applied, what was rejected, and why. A hand-off that turns out to be wrong is worth naming.
4. Push whenever a coherent integration unit exists.

Reassign the consequences an owner's change created but did not close. Widening a union or making a required field optional is a claim about every consumer of it, and the consumers usually live in files that owner does not own.

## Validate With CI And The Integration Self-Review

Read CI once per settled head. It gates the cycle, not each commit, so an intermediate commit's result never justifies pausing implementation. Treat a red result on a head the cycle has moved past as information, not as the gate.

CI is also the arbiter for anything that fails only locally. A clean CI environment settles whether a failure is a defect or an artifact of one machine, which is cheaper and more honest than guessing at a fix.

When every owner has reported and their work is integrated, the main agent runs **one integration Self-Review** over the whole base-to-head diff, under the [review skill's law](../review/SKILL.md#non-negotiable-review-law). It is a fresh complete round over the whole surface, and it does not inherit any owner's round.

The owners' rounds and the integration round answer different questions. An owner reads its own issue's surface. The integration round reads what only appears between issues: a helper two owners wrote twice, a validator whose new branch leaves a mirrored DTO stale, a document claiming a verification nothing performs, a limit one owner recorded and another silently relied on.

CI and review remain independent gates:

- CI must prove every configured build, type-check, test, packaging, and platform lane.
- The integration Self-Review must prove requirement fidelity, consequence coverage, issue-by-issue acceptance, test quality, documentation, generated output, and risks not encoded in CI.

When either gate finds a defect:

1. Diagnose the real cause from the CI log or review evidence.
2. Correct the source and complete the corresponding regression coverage, or hand it back to the owner whose surface it is when that owner is still active.
3. Run `pnpm run format`.
4. Commit and push the correction.
5. Let the new CI run to completion and restart the integration Self-Review as a fresh complete round over the new head.

Fix every red CI lane in the same campaign pull request even when the failure predates the campaign or is unrelated to its original issues.

Do not merge a head whose green checks belong to an older SHA or whose clean review predates a correction. Continue the loop until the same immutable head has green required checks and a complete integration Self-Review round with no sound improvement.

Submit each Self-Review finding round and the final clean round as a formal GitHub pull-request review with the `COMMENT` event. Attach line-specific findings as inline review comments and summarize round-wide findings in the review body. Follow the [pull-request skill](../pull-request/SKILL.md#write-the-pull-request) for self-review restrictions.

## Merge And Clean Up

Merge only with user authorization, including a campaign-local standing authorization that explicitly covers merge.

Before merging, reconcile the closing keywords against what survives at `HEAD`. `git log origin/master..HEAD` shows every message the squash will concatenate, including commits a later one reverted, so read the whole range and confirm each issue the merge will close has a surviving fix.

After merge:

1. Verify GitHub records the pull request as merged into the intended target and every linked issue has the correct final state. Reopen any issue the squash merge closed without a surviving fix, and comment that the merge closed it mechanically.
2. Confirm the checkout has no unpushed or uncommitted work worth preserving.
3. Switch back to the target branch, pull with `git pull --ff-only`, and delete the local topic branch.
4. For every assignment-created external path, confirm no live process or other assignment uses it, preserve required evidence, delete only the exact proven path, and verify it is absent.
5. Never bulk-delete a shared temporary directory, a global build cache, an installed toolchain, or an asset whose ownership is uncertain.

Formatting belongs to the unified cycle pull request, so a separate post-campaign formatting pull request is not part of this workflow.

## Repeat Until A Clean Round

After every merged cycle, return to the parent skill's Discover Issues phase and perform another complete fresh round over the entire declared scope.

If any meaningful candidate survives fact-checking, adjudicate and publish it when authorized, then claim the next single cycle pull request containing every implementation-ready issue. Repeat discovery, dispatch, integration, CI, review, merge, and cleanup without a fixed round limit.

The campaign succeeds only when all of these are true:

- one complete fresh full-scope discovery round produces no meaningful candidate after fact-checking;
- no accepted or published campaign issue remains unresolved;
- no campaign pull request, branch, process, or assignment-owned temporary asset remains; and
- the target checkout is clean and synchronized.

If an external blocker makes those conditions impossible, report the campaign as blocked rather than complete.
