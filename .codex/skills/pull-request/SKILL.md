---
name: pull-request
description: PR submission flow. Every topic-unit ships as its own PR; merge only on explicit user request.
---

# Pull Request Submission

Standing instruction (user, 2026-07-06): work proceeds in **topic-unit PRs** — one coherent topic per PR, opened when the topic's changes are green locally. Never merge on your own initiative. Merge only when the user explicitly asks to merge. Never commit to `master` directly.

## Branch from the target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `test/<scope>`, `docs/<scope>`, `ci/<scope>`.

## Group changes into logical commits

One commit per coherent unit, not a single mega-commit when the diff is large. Use the repository's `<type>(<scope>): <subject>` message style, and end the message with the `Co-Authored-By` trailer. Run `pnpm run format` before each commit.

## Write the PR body at open

Write the PR body at open: intent, scope, deferred items, test plan (including the coverage result). Treat it as the PR's historical intent statement. Do not rewrite the body on every follow-up push; subsequent CI fixes and newly-found issues go in `gh pr comment`.

## Watch checks after every push

After every push, watch `gh pr checks <PR>` until each check settles. On failure, fetch the job log, diagnose, fix in place, push a new commit, and let the checks resume. Both `build` and `test` (the 100% coverage gate) must pass.

## Merge on explicit request

When the user explicitly asks to merge and every required check passes, squash-merge the PR (matching the repo's linear history) and delete the branch.

If CI is red because code, tests, build, formatting, or generated artifacts failed, fix the PR and wait for green.

If CI cannot start or finish for external repository infrastructure reasons outside the topic's code scope (for example billing, service outage, missing runner capacity, or permissions), report the exact blocker, document the local verification in the PR, and merge only after the user explicitly repeats the merge instruction. Do not force-merge against GitHub branch protection; if GitHub refuses the merge, report the blocker.
