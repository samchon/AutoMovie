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
- Respect package boundaries. `three.js` is imported only inside `viewer` among the library packages (`playground` imports it as the demo application that mounts the viewer); computation flows through `engine`; the agent-facing surface is `mcp` (and the `cli` scaffolder), which consume `interface` + `engine`, never the reverse. No test enforces this, so it is read in review. The `interface` package stays pure types with **no runtime dependency**: it is the AST the LLM emits against, and its constraints live in field JSDoc, not in `typia` tags (which is why the last such tag, and interface's `typia` dependency, were removed).
- **Rough types in `interface`.** Primitives are plain `string`/`number`: no wrapper aliases like `AutoMovieUuid`, no `typia` tag constraints (`Minimum`, `MinItems`, `Format`). Units and ranges are documented in field JSDoc and enforced at runtime by `engine` validators (this is where the ROM differentiator lives). The only structural constraints are closed `AutoMovie*` unions (bone names, ARKit channels, presets, easing). Those are allowed-value sets, not wrappers.
- Keep changes surgical. Touch only what the request and the verified consequence surface require; do not refactor adjacent code without a product reason.
- Preserve committed traceability when changing a public export. Read the [evidence graph skill](../evidence-graph/SKILL.md), update its direct requirement and specification citations with the implementation, and validate the affected triangle rather than treating JSDoc as incidental text.
- **A solver lands with the consumer that calls it.** A validated, fully covered fold no product path reaches is a public surface with maintenance cost and no effect on any frame; one cycle shipped three of them past every gate. Wire the producer to its consumer in the same change, register it on a reviewed authoring surface, or mark a deliberately early API with `@publicUnconsumed <planned consumer>: <reason>`. That tag is the declared form, so the next reader is not left parsing prose: the planned consumer names a concrete future component and the reason explains why the API must land before it, while `none`, `unknown`, `TBD`, and equivalent placeholders are invalid. A test proves behavior but remains test reach rather than a product consumer, so test-only reach never counts as wiring. Count consumers by resolved symbol, never by grepping `name(`: a call written through a package barrel and a name that is merely a catalogue string both defeat the textual probe. **Nothing enforces this yet** (see `#1947`), so it is read in review.
- **A deliberate break lives one at a time, and the tree is safe at every instant.** Disabling a guard to prove a scenario actually fails is the only way to know a green suite is measuring anything, so the technique is required rather than merely allowed. What is not allowed is holding two of them, or leaving one across a step you might not return from: a session limit ended four owners in the same instant, and one of them was mid-flip. What sat in the tree was `if (true) return;` on the line after the knowledge gate's early exit, which would have opened every MCP tool without its guide, and it compiled, kept most of the suite green, and read as ordinary work in the diff. Flip one condition, run the one scenario it pins, restore it by edit, and only then take the next; `git checkout` is not a restore here, because it discards whatever else the shared checkout has gained. Before any commit, read `git status` and `git diff` rather than trusting memory of what you changed.
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

**A case that arranges its own subject must fail when the arrangement fails.** A refusal case that rewrites scaffold source by string anchor, an oracle injected into a fixture, a probe spliced into a generated file: when the anchor is gone, `String.replace` returns the input and the case proceeds against unmutated material, so it does not go red, it quietly starts asserting something else. Route every such rewrite through a helper that throws when it changed nothing, rather than trusting that the anchor still exists.

**A structural guard re-pins from the failure's own output, never from a hash you found nearby.** Guards that pin a source digest, a statement index or a token count go red on every legitimate edit to the file they read, which is what they are for. Read the reported actual value at its own key and replace the expected value at that key; picking hashes out of the surrounding text in output order writes a real digest into the wrong field and produces a guard that passes while measuring nothing.

**A measurement nothing gates goes back up.** Counting a defect class is what makes it payable, and paying it down once is not the same as keeping it down. Three counts in this repository have drifted while a tool that measured them sat unused: diagnostic codes outgrew the guides that name them, guide coverage emptied and refilled without anyone noticing, and the folded-assertion count returned after a PR drove it down. When you build the measure, wire it to a check in the same change, and fix the total rather than a per-file exemption list, because an exemption list is the thing that never shrinks.

**A new compiler obligation is first a claim about every existing fixture.** A gate the compiler did not have is a gate no fixture was written against, so the first run after adding one reports defects the fixtures were already carrying. Read each as a finding about the fixture before treating it as evidence the gate is too strict; a fixture is the cheapest place a real contradiction shows up.

## Coverage is 100% on what you write

**Every source file a change creates or modifies ends at 100% on statements, branches, functions, and lines.** That is the obligation, it is per change, and it is not negotiable by difficulty.

The repository total is a different number and always has been. `test.yml` says why: the whole measured set has never met 100%, a permanently red job told nobody anything, and it buried real regressions in the same colour. So the repository carries inherited gaps in files nobody has touched, and closing them is its own work rather than a toll on the next unrelated change.

What that means in practice:

- Bring a file you touched to 100%, including the parts you did not write, when your change is what makes them reachable or newly wrong. A branch your edit created is yours without argument.
- Do not treat an inherited gap in a file you never opened as your obligation, and do not report the repository total as if it were your result.
- Report the per-file numbers for the files you own, with the command and the moment you measured them.

The measured set is `archetypes`, `engine`, `face`, `ingest`, `render`, `viewer`, `mcp`, and one file of `cli` (see the `--src` and `--include` lists in the `coverage` script; it runs with `--all`, so a source no test imports is reported rather than silently absent, and `index.ts` and `bin.ts` are excluded everywhere). Measure with `pnpm --filter @automovie/test coverage` (c8 writes only under `node_modules/.cache/`; an absolute `/tmp` path silently measured nothing on Windows. Never leave `coverage/` or `.nyc_output/` in the tree, and never paper over them with `.gitignore`). CI measures and reports beside the suite without failing on it, and `internals/report-coverage-gaps.mjs` prints the exact uncovered statements, branches and functions on every run. So the gate is the author reading that output, not the build going red, and a gap that ships is a gap somebody chose.

**100% is earned by testing, not by hiding code.** A suite of happy paths that reaches every line is not 100% correctness:

- **A negative twin for every positive.** Wherever a validator fires (ROM, range, temporal, type), pin an adjacent case one property away where it must NOT fire. An over-match stays invisible until the counter-example exists.
- **Both sides of every branch.** A `?? null`, an `if`, a discriminated union arm: exercise each side with a real input (asymmetric keyframes, opposite-hemisphere slerp, a non-box primitive, a skeletonless model).
- **Boundaries.** The empty case, the single element, the exact limit, the immobile axis, the degenerate/zero input.
- **Oracle-derived expectations.** Take expected numbers from the spec or hand math, not from whatever the code currently emits. A snapshot of the code's own output locks its bugs in.

Do not reach 100% by ignoring a branch. A genuinely unreachable defensive branch is removed by refactoring (drop a dead lookup, document a precondition), not hidden behind `c8 ignore`.

## Validation

Run the narrowest command that proves the change first, then a broader one when shared behavior or packaging changed. Report any command that could not be run.

- **Bug fix**: name the failing case and expected behavior; add a repro test that fails before and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end, and for a render/viewer change verify visually (`viewer-verification/SKILL.md`).
- **Refactor**: name what stays unchanged; rely on the suite or a behavior-locking probe, and re-measure coverage.
- **Review**: name concrete risks, missing tests, regressions.

## Change Integrity

Treat tests, fixtures, CI workflows, package wiring, dependencies, the `interface` core types, and the ROM/constraint tables as part of the specification. Changing them needs an explicit user request or a clear product reason, and the final report must call it out. For broad rewrites (e.g. generalizing the rig model), preserve existing public behavior in reviewable slices and inspect the diff before trusting a green run.
