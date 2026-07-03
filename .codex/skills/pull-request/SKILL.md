---
name: pull-request
description: PR submission flow. Standing instruction (2026-07-03) — every topic-unit of work ships as its own PR and merges once CI is green.
---

# Pull Request Submission

Standing instruction (user, 2026-07-03): work proceeds in **topic-unit PRs** — one coherent topic per PR, opened when the topic's changes are green locally, merged once CI passes. This replaces the earlier ask-per-PR/ask-per-merge rule. Never commit to `master` directly.

## Branch from the target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `test/<scope>`, `docs/<scope>`, `ci/<scope>`.

## Group changes into logical commits

One commit per coherent unit, not a single mega-commit when the diff is large. Use the repository's `<type>(<scope>): <subject>` message style, and end the message with the `Co-Authored-By` trailer. Run `pnpm run format` before each commit.

## Write the PR body at open

Write the PR body at open: intent, scope, deferred items, test plan (including the coverage result). Treat it as the PR's historical intent statement. Do not rewrite the body on every follow-up push; subsequent CI fixes and newly-found issues go in `gh pr comment`.

## Watch checks after every push

After every push, watch `gh pr checks <PR>` until each check settles. On failure, fetch the job log, diagnose, fix in place, push a new commit, and let the checks resume. Both `build` and `test` (the 100% coverage gate) must pass.

## Merge on green

When every check passes, squash-merge the PR (matching the repo's linear history) and delete the branch. A red or pending check is an absolute merge blocker — fix in place and wait for green; never bypass or force-merge. If CI cannot be made green within the topic's scope, stop and hand the PR back to the user with the diagnosis.
