---
name: pull-request
description: Defines automovie branch, commit, pull-request, check, and merge workflows. Use when shipping a topic-unit PR under the standing instruction, when the user asks to open, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery; never merge on unprompted initiative.
---

# Pull Request Submission

Standing instruction (user, 2026-07-06): work proceeds in **topic-unit PRs** — one coherent topic per PR, opened when the topic's changes are green locally. Never commit to `master` directly.

Permission to open is not permission to merge. Merge only when the user explicitly asks, or under a **standing autonomous mandate** — an autonomous campaign (e.g. the conquest loop) or an explicit instruction to carry the work through merge. The mandate is the request for every step it names, including push and merge, and every check, verification, and Self-Review gate still applies to each step.

## Branch From The Target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `test/<scope>`, `docs/<scope>`, `ci/<scope>`.

If the current checkout contains unrelated or protected work, create an isolated worktree from the target branch instead of stashing, reverting, or mixing it.

## Commit Logical Units

One commit per coherent unit, not a single mega-commit when the diff is large. Use the repository's `<type>(<scope>): <subject>` message style, and end the message with the `Co-Authored-By` trailer. Run `pnpm run format` before each commit.

Stage explicit paths when the worktree is mixed. Never include unrelated user changes silently.

## Write The Pull Request

Write the PR body at open: intent, scope, deferred items, test plan (including the coverage result). Treat it as the PR's historical intent statement. Use a file-backed body for multiline Markdown when opening through `gh`.

Do not rewrite the body on every follow-up push; subsequent CI fixes and newly-found issues go in `gh pr comment` so the thread preserves chronology. The title describes the merged outcome in `<type>(<scope>)` style, not the work process.

## Watch Checks After Every Push

After every push, watch `gh pr checks <PR>` until each check settles. On failure, fetch the job log, diagnose the real cause, fix it in place, push a new commit, and let the checks resume. Both `build` and `test` (the 100% coverage gate) must pass; do not treat a green unrelated job as acceptance for a failed required surface.

## Merge On Explicit Request Or Standing Autonomous Mandate

When the user explicitly asks to merge, or a standing autonomous mandate authorizes it, and every required check passes, squash-merge the PR (matching the repo's linear history) and delete the branch.

If CI is red because code, tests, build, formatting, or generated artifacts failed, fix the PR and wait for green.

If CI cannot start or finish for external repository infrastructure reasons outside the topic's code scope (for example billing, service outage, missing runner capacity, or permissions), report the exact blocker, document the local verification in the PR, and merge only after the user explicitly repeats the merge instruction. Do not force-merge against GitHub branch protection; if GitHub refuses the merge, report the blocker.
