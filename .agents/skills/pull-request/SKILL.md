---
name: pull-request
description: Defines automovie branch, commit, pull-request, check, and merge workflows. Use when shipping a topic-unit PR under the standing instruction, when the user asks to open, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery; never merge on unprompted initiative.
---

# Pull Request Submission

Standing instruction (user, 2026-07-06): work proceeds in **topic-unit PRs**: one coherent topic per PR, opened when the topic's changes are green locally. Never commit to `master` directly.

Permission to open is not permission to merge. Merge only when the user explicitly asks, or under a **standing autonomous mandate**, an autonomous campaign (e.g. the conquest loop) or an explicit instruction to carry the work through merge. The mandate is the request for every step it names, including push and merge, and every check, verification, and Self-Review gate still applies to each step.

## Branch From The Target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `test/<scope>`, `docs/<scope>`, `ci/<scope>`.

Ordinary pull requests, issue campaigns, and Self-Review use the current checkout and one topic branch. This holds even when a campaign runs several issue owners at once: they share that checkout and that branch, each committing only its own paths. Do not create another clone or worktree for them. If unrelated or protected work prevents a safe branch switch, preserve it and report the blocker rather than stashing, reverting, mixing it, or creating a worktree.

Only an explicitly selected multi-agent campaign creates isolated worktrees, under that campaign's file-ownership and cleanup rules.

## Commit Logical Units

One commit per coherent unit, not a single mega-commit when the diff is large. Use the repository's `<type>(<scope>): <subject>` message style, and end the message with the `Co-Authored-By` trailer. Run `pnpm run format` before commits that change configured source. For Markdown-only and agent-instruction commits, inspect the direct diff and run `git diff --check` instead.

Stage explicit paths when the worktree is mixed. Never include unrelated user changes silently.

## Write The Pull Request

Write the PR body at open: intent, scope, deferred items, test plan (including the coverage result). Treat it as the PR's historical intent statement. Use a file-backed body for multiline Markdown when opening through `gh`.

Do not rewrite the body on every follow-up push. Record later CI fixes, newly found issues, and Self-Review results as formal GitHub pull-request reviews with the `COMMENT` event so the thread preserves chronology. Use an inline review comment when an observation belongs to a changed line, and the review body for commit-wide or round-wide results. Never `APPROVE` or `REQUEST_CHANGES` on your own pull request.

The title describes the merged outcome in `<type>(<scope>)` style, not the work process.

## Campaign Override

Before a campaign implementation push or pull request, complete the selected campaign's development procedure. Ordinary issue campaigns use `.agents/skills/issue-campaign/development.md` in the current checkout, including when several issue owners implement at once. Campaigns the user asked to isolate into per-batch worktrees, branches, or pull requests use `.agents/skills/multi-agent/issue-campaign.md`. Their ownership, worktree, commit-message, check-cadence, CI-repair, and cleanup rules override the ordinary flow here.

A campaign owner pushes its own commits. It stages explicit paths, never `git add -A`, and never rewrites or force-pushes a branch other owners are committing onto.

## Watch Checks After Every Push

After every push, watch `gh pr checks <PR>` until each check settles. On failure, fetch the job log, diagnose the real cause, fix it in place, push a new commit, and let the checks resume. Both `build` and `test` must pass; do not treat a green unrelated job as acceptance for a failed required surface. `test` fails on a failing scenario **and on coverage**: #2153 made the per-change obligation a hard failure condition, so the lane exits 1 on a reported gap and 2 on an instrument failure. Read the gaps the way the development skill explains, and read them knowing that a whole-suite per-file figure is a lower bound: confirm a gap with a scoped run before chasing it. A file the lane refuses may be fully covered, which was measured on this repository and is #2163's.

The `build` and `test` workflows run for pull requests and pushes to `master`. Each run checks the event-owned base-to-head range before validation and must finish with no tracked diff or unignored file. The test run uses that same base SHA for changed-line coverage. A pull-request run uses `pull_request.base.sha...pull_request.head.sha`; a push run uses `before...sha`. Do not replace either with a mutable branch name or a locally inferred merge base.

A campaign implementation cycle reads CI once per settled head instead, under its own development procedure. Its intermediate commits are not gates, and its merge still requires the settled head's green required checks.

## Merge On Explicit Request Or Standing Autonomous Mandate

When the user explicitly asks to merge, or a standing autonomous mandate authorizes it, and every required check passes, squash-merge the PR (matching the repo's linear history) and delete the branch.

After GitHub records the merge, observe the `master` push `build` and `test` checks on the exact merge commit. A green pull-request head does not substitute for the post-merge event, and a red master run reopens delivery work immediately.

If CI is red because code, tests, build, formatting, generated artifacts, or changed coverage failed, fix the PR and wait for green. A coverage refusal the scoped run contradicts is still red, and still not yours to merge over: report it and hand the measurement to the issue that owns the gate.

If CI cannot start or finish for external repository infrastructure reasons outside the topic's code scope (for example billing, service outage, missing runner capacity, or permissions), report the exact blocker, document the local verification in the PR, and merge only after the user explicitly repeats the merge instruction. Do not force-merge against GitHub branch protection; if GitHub refuses the merge, report the blocker.
