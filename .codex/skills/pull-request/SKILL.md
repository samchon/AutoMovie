---
name: pull-request
description: PR submission flow. Read only when the user explicitly asks for a pull request; never open, push, propose, or merge a PR on your own initiative.
---

# Pull Request Submission

Only act on this skill when the user explicitly asks for a pull request. Never open, propose, or push a new PR on your own initiative, not as a "helpful" follow-up to a finished change, not because the work looks done. (This bounds PR creation only; it does not change how you commit to a branch.) When the user does ask, follow this flow.

## Branch from the target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `test/<scope>`, `docs/<scope>`, `ci/<scope>`.

## Group changes into logical commits

One commit per coherent unit, not a single mega-commit when the diff is large. Use the repository's `<type>(<scope>): <subject>` message style, and end the message with the `Co-Authored-By` trailer. Run `pnpm run format` before each commit.

## Write the PR body at open

Write the PR body at open: intent, scope, deferred items, test plan (including the coverage result). Treat it as the PR's historical intent statement. Do not rewrite the body on every follow-up push; subsequent CI fixes and newly-found issues go in `gh pr comment`.

## Watch checks after every push

After every push, watch `gh pr checks <PR>` until each check settles. On failure, fetch the job log, diagnose, fix in place, push a new commit, and let the checks resume. Both `build` and `test` (the 100% coverage gate) must pass.

## Never merge without an explicit instruction

The agent does not merge, squash-merge, or rebase the target branch. When all checks pass, hand the PR back to the user for review. Merge **only** when the user gives an explicit, separate instruction to merge (a green CI is not that instruction). Auto-merging a passing PR is a hard violation.
