---
name: development
description: Work rules, testing, the always-100% coverage mandate, validation, change integrity. Read before writing or modifying code.
---

# Development

## Work Rules

- Match existing conventions. Before adding a file, type, or test, open a nearby peer and mirror its naming, location, and style; don't create parallel structures.
- Respect package boundaries. `@agentica/core` is imported only inside the `agent` package; `three.js` only inside `viewer`; computation flows through `engine`. The `interface` package stays pure types with a `typia`-only dependency.
- **Rough types in `interface`.** Primitives are plain `string`/`number` — no wrapper aliases like `AutoFilmUuid`, no `typia` tag constraints (`Minimum`, `MinItems`, `Format`). Units and ranges are documented in field JSDoc and enforced at runtime by `engine` validators (this is where the ROM differentiator lives). The only structural constraints are closed `AutoFilm*` unions (bone names, ARKit channels, presets, easing) — those are allowed-value sets, not wrappers.
- Run `pnpm run format` before every commit and stage the result; never commit unformatted output.
- Update the matching `.wiki/` doc in the same change when behavior, architecture, or a decision changes (see `documentation/SKILL.md`).

## Testing

Tests are `@nestia/e2e` `DynamicExecutor` cases under `test/src/features/<domain>/`. **One scenario per file, the exported `test_<snake_case>` matching the file name.** Builders and boolean predicates live under `features/internal/` (`createSkeleton`, `joint`, `makeMotion`, `hasViolation`, `vclose`, `qclose`); do not reach into another concern's internals.

Assert with `TestValidator.equals(title, actual, expected)` for exact values and `TestValidator.predicate(title, <boolean>)` for floats (build the boolean with the `nclose`/`vclose`/`qclose` helpers, never deep-equality on floats). Code JSDoc is English in the interia voice: a contract paragraph (what it pins and why) followed by a numbered `Scenarios:` list naming each experiment's inputs, expected result, and the branch it guards.

Run with `pnpm --filter @autofilm/test start`; type-check with `pnpm --filter @autofilm/test build` (the suite itself runs straight through ts-node, no compile step).

## Coverage is always 100%

Engine coverage is held at **100% on statements, branches, functions, and lines** at all times. Measure with `pnpm --filter @autofilm/test coverage` (c8 writes only to `/tmp`; never leave `coverage/` or `.nyc_output/` in the tree, and never paper over them with `.gitignore`). The `test` CI workflow gates this — a drop fails the build.

**100% is earned by testing, not by hiding code.** A suite of happy paths that reaches every line is not 100% correctness:

- **A negative twin for every positive.** Wherever a validator fires (ROM, range, temporal, type), pin an adjacent case one property away where it must NOT fire.
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
