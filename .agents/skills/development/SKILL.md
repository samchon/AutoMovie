---
name: development
description: Defines automovie implementation rules, testing standards, the always-100% coverage mandate, validation, consequence analysis, and change integrity. Use before writing or modifying source, tests, workflows, package wiring, or fixtures.
---

# Development

## Contents

- [Forbidden](#forbidden)
- [Work Rules](#work-rules)
- [Consequence Analysis](#consequence-analysis)
- [Testing](#testing)
- [Coverage is always 100%](#coverage-is-always-100)
- [Validation](#validation)
- [Change Integrity](#change-integrity)

## Forbidden

These four are never acceptable; choosing any one means the approach is already wrong.

- **No monkey-patching or hardcoding.** Don't special-case a consumer, a fixture name, or an expected value to make output match. Fix the general logic.
- **No test-passing-only logic.** Code exists to be correct, not to turn a check green. A branch whose only purpose is to satisfy one assertion is a bug in disguise.
- **No forcing a broken design.** When the same failure keeps returning under patch after patch, the design is wrong. Stop, find the root cause, and fix the design instead of looping forever on symptoms.
- **No whack-a-mole.** Don't patch the one case that surfaced and move on. Think expansively about every case the same root cause can produce, and seal them all with coverage so the class of failure cannot recur.

## Work Rules

- Match existing conventions. Before adding a file, type, or test, open a nearby peer and mirror its naming, location, and style; don't create parallel structures.
- Respect package boundaries. `three.js` is imported only inside `viewer`; computation flows through `engine`; the agent-facing surface is `mcp` (and the `cli` scaffolder), which consume `interface` + `engine`, never the reverse. The `interface` package stays pure types with **no runtime dependency** — it is the AST the LLM emits against, and its constraints live in field JSDoc, not in `typia` tags (which is why the last such tag, and interface's `typia` dependency, were removed).
- **Rough types in `interface`.** Primitives are plain `string`/`number` — no wrapper aliases like `AutoMovieUuid`, no `typia` tag constraints (`Minimum`, `MinItems`, `Format`). Units and ranges are documented in field JSDoc and enforced at runtime by `engine` validators (this is where the ROM differentiator lives). The only structural constraints are closed `AutoMovie*` unions (bone names, ARKit channels, presets, easing) — those are allowed-value sets, not wrappers.
- Keep changes surgical. Touch only what the request and the verified consequence surface require; do not refactor adjacent code without a product reason.
- Run `pnpm run format` before every commit and stage the result; never commit unformatted output.
- Update the matching `.wiki/` doc in the same change when behavior, architecture, or a decision changes (see `documentation/SKILL.md`).

## Consequence Analysis

Treat a reported example as one witness of a cause, not the complete problem statement. Before changing code, trace the same cause through:

- every caller and downstream consumer, including the `mcp` tool surface and the viewer's projection of engine output;
- normal, error, and recovery state transitions;
- sampling, caching, and determinism (the same inputs must always yield the same frames);
- Windows and POSIX behavior;
- compatibility constraints and boundary inputs.

Fix the verified class of failure, not only the reported witness. Cover positive, negative, and boundary cases without expanding the user's product goal.

## Testing

Tests are `@nestia/e2e` `DynamicExecutor` cases under `test/src/features/<domain>/`. **One scenario per file, the exported `test_<snake_case>` matching the file name.** Builders and boolean predicates live under `features/internal/` (`createSkeleton`, `joint`, `makeMotion`, `hasViolation`, `vclose`, `qclose`); do not reach into another concern's internals.

Assert with `TestValidator.equals(title, actual, expected)` for exact values and `TestValidator.predicate(title, <boolean>)` for floats (build the boolean with the `nclose`/`vclose`/`qclose` helpers, never deep-equality on floats). Code JSDoc is English in the interia voice: a contract paragraph (what it pins and why) followed by a numbered `Scenarios:` list naming each experiment's inputs, expected result, and the branch it guards.

Run with `pnpm --filter @automovie/test start`; type-check with `pnpm --filter @automovie/test build` (the suite itself runs straight through ts-node, no compile step).

## Coverage is always 100%

Coverage is held at **100% on statements, branches, functions, and lines** at all times, across the whole measured set — `engine`, `forge`, `ingest`, `render`, and `mcp` (see the `--src` list in the `coverage` script). Measure with `pnpm --filter @automovie/test coverage` (c8 writes only under `node_modules/.cache/`; an absolute `/tmp` path silently measured nothing on Windows. Never leave `coverage/` or `.nyc_output/` in the tree, and never paper over them with `.gitignore`). The `test` CI workflow gates this — a drop fails the build.

**100% is earned by testing, not by hiding code.** A suite of happy paths that reaches every line is not 100% correctness:

- **A negative twin for every positive.** Wherever a validator fires (ROM, range, temporal, type), pin an adjacent case one property away where it must NOT fire. An over-match stays invisible until the counter-example exists.
- **Both sides of every branch.** A `?? null`, an `if`, a discriminated union arm — exercise each side with a real input (asymmetric keyframes, opposite-hemisphere slerp, a non-box primitive, a skeletonless model).
- **Boundaries.** The empty case, the single element, the exact limit, the immobile axis, the degenerate/zero input.
- **Oracle-derived expectations.** Take expected numbers from the spec or hand math, not from whatever the code currently emits — a snapshot of the code's own output locks its bugs in.

Do not reach 100% by ignoring a branch. A genuinely unreachable defensive branch is removed by refactoring (drop a dead lookup, document a precondition), not hidden behind `c8 ignore`.

## Validation

Run the narrowest command that proves the change first, then a broader one when shared behavior or packaging changed. Report any command that could not be run.

- **Bug fix**: name the failing case and expected behavior; add a repro test that fails before and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end, and for a render/viewer change verify visually (`viewer-verification/SKILL.md`).
- **Refactor**: name what stays unchanged; rely on the suite or a behavior-locking probe, and re-measure coverage.
- **Review**: name concrete risks, missing tests, regressions.

## Change Integrity

Treat tests, fixtures, CI workflows, package wiring, dependencies, the `interface` core types, and the ROM/constraint tables as part of the specification. Changing them needs an explicit user request or a clear product reason, and the final report must call it out. For broad rewrites (e.g. generalizing the rig model), preserve existing public behavior in reviewable slices and inspect the diff before trusting a green run.
