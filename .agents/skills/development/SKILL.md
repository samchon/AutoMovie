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
- [Coverage is 100% on what you write](#coverage-is-100-on-what-you-write)
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
- Respect package boundaries. `three.js` is imported only inside `viewer` among the library packages (`playground` imports it as the demo application that mounts the viewer); computation flows through `engine`; `production` orchestrates `interface`, `engine`, `evidence`, and `render`; and the authoring surface is the generated project's tracked instructions and scripts plus the `cli` scaffolder, never a network tool server. No test enforces this, so it is read in review. The `interface` package stays pure types with **no runtime dependency**: it is the AST the LLM emits against, and its constraints live in field JSDoc, not in `typia` tags (which is why the last such tag, and interface's `typia` dependency, were removed).
- **Rough types in `interface`.** Primitives are plain `string`/`number`: no wrapper aliases like `AutoMovieUuid`, no `typia` tag constraints (`Minimum`, `MinItems`, `Format`). Units and ranges are documented in field JSDoc and enforced at runtime by `engine` validators (this is where the ROM differentiator lives). The only structural constraints are closed `AutoMovie*` unions (bone names, ARKit channels, presets, easing). Those are allowed-value sets, not wrappers.
- Keep changes surgical. Touch only what the request and the verified consequence surface require; do not refactor adjacent code without a product reason.
- Preserve committed traceability when changing a public export. Read the [evidence graph skill](../evidence-graph/SKILL.md), update its direct requirement and specification citations with the implementation, and validate the affected triangle rather than treating JSDoc as incidental text.
- **A solver lands with the consumer that calls it.** A validated, fully covered fold no product path reaches is a public surface with maintenance cost and no effect on any frame; one cycle shipped three of them past every gate. Wire the producer to its consumer in the same change, register it on a reviewed package README or on the shipped authoring skill, or mark a deliberately early API with `@publicUnconsumed <planned consumer>: <reason>`. That tag is the declared form, so the next reader is not left parsing prose: the planned consumer names a concrete future component and the reason explains why the API must land before it, while `none`, `unknown`, `TBD`, and equivalent placeholders are invalid. A test proves behavior but remains test reach rather than a product consumer, so test-only reach never counts as wiring. Self-Review traces each new public callable to its real repository consumer, reviewed authoring document, or valid early-API declaration; it does not recreate that judgment as a source-text or repository-shape test.
- **A deliberate break lives one at a time, and the tree is safe at every instant.** Disabling a guard to prove a scenario actually fails is the only way to know a green suite is measuring anything, so the technique is required rather than merely allowed. What is not allowed is holding two of them, or leaving one across a step you might not return from: a session limit ended four owners in the same instant, and one of them was mid-flip. What sat in the tree was `if (true) return;` on the line after the knowledge gate's early exit, which would have opened every capture without the compile status that gates it, and it compiled, kept most of the suite green, and read as ordinary work in the diff. Flip one condition, run the one scenario it pins, restore it by edit, and only then take the next; `git checkout` is not a restore here, because it discards whatever else the shared checkout has gained. Before any commit, read `git status` and `git diff` rather than trusting memory of what you changed.
- **A configured check is not a running check until it has been made to fail.** A guard you disabled and restored is armed by definition; a guard configured by a selector may never have been armed at all, and it reports the same green either way. The former scaffold graph config carried a claim binding every shot to the script scene it realizes, with `symbol: "function"`. A shot is `export const opening = defineShot(...)`, a `const` initialized with a call, which `@ttsc/evidence` classifies as a `property`. The claim selected no host, a claim with an empty host population is dropped before its references are read, and deleting **every** citation it was supposed to require still reported PASS. It had enforced nothing since the day it was written. The same shape has already cost this repository twice more: a lint probe with no `package.json` produced no diagnostics for anything, and a CI workflow reported success having run zero steps. So when you add or inherit a lint rule, an evidence claim, a coverage threshold, or a CI job, delete the thing it is supposed to catch and watch it go red before you believe the green. Where the check has a population, count what it selected rather than trusting that it selected anything.
- Run `pnpm run format` before every commit and stage the result; never commit unformatted output.
- Update the matching `.wiki/` doc in the same change when behavior, architecture, or a decision changes (see `documentation/SKILL.md`).

## Consequence Analysis

Treat a reported example as one witness of a cause, not the complete problem statement. Before changing code, trace the same cause through:

- every caller and downstream consumer, including generated-project scripts and the viewer's projection of engine output;
- normal, error, and recovery state transitions;
- sampling, caching, and determinism (the same inputs must always yield the same frames);
- Windows and POSIX behavior;
- compatibility constraints and boundary inputs.

Fix the verified class of failure, not only the reported witness. Cover positive, negative, and boundary cases without expanding the user's product goal.

## Testing

Tests are `@nestia/e2e` `DynamicExecutor` cases under `test/src/features/<domain>/`. **One scenario per file, the exported `test_<snake_case>` matching the file name.** Builders and boolean predicates live under `features/internal/` (`createSkeleton`, `joint`, `makeMotion`, `hasViolation`, `vclose`, `qclose`); do not reach into another concern's internals.

Only unit and logic tests belong in this repository. Exercise a function or module through its typed inputs and observable result, including its positive, negative, and boundary behavior. Do not install a generated project, launch a CLI or child process, reproduce operating-system or filesystem semantics, or keep an end-to-end scenario whose cost does not prove product logic.

Never hardcode a test to the current repository shape or implementation text. A test must not read source, `package.json`, workflow YAML, configuration bytes, line counts, export spellings, or a generated file merely to compare them with literals copied from the same implementation. Expected values come from the product contract, a specification, or an independent calculation; when the only way to update a test is to copy the implementation's new output, the test does not qualify.

Assert with `TestValidator.equals(title, actual, expected)` for exact values and `TestValidator.predicate(title, <boolean>)` for floats (build the boolean with the `nclose`/`vclose`/`qclose` helpers, never deep-equality on floats). Code JSDoc is English in the interia voice: a contract paragraph (what it pins and why) followed by a numbered `Scenarios:` list naming each experiment's inputs, expected result, and the branch it guards.

Run with `pnpm --filter @automovie/test start`; type-check with `pnpm --filter @automovie/test build` (the suite itself runs straight through `ttsx`, with no emitted compile step).

**A case that arranges its own subject must fail when the arrangement fails.** A refusal case that rewrites scaffold source by string anchor, an oracle injected into a fixture, a probe spliced into a generated file: when the anchor is gone, `String.replace` returns the input and the case proceeds against unmutated material, so it does not go red, it quietly starts asserting something else. Route every such rewrite through a helper that throws when it changed nothing, rather than trusting that the anchor still exists.

**A structural guard re-pins from the failure's own output, never from a hash you found nearby.** Guards that pin a source digest, a statement index or a token count go red on every legitimate edit to the file they read, which is what they are for. Read the reported actual value at its own key and replace the expected value at that key; picking hashes out of the surrounding text in output order writes a real digest into the wrong field and produces a guard that passes while measuring nothing.

**A measurement nothing gates goes back up.** Counting a defect class is what makes it payable, and paying it down once is not the same as keeping it down. Three counts in this repository have drifted while a tool that measured them sat unused: diagnostic codes outgrew the guides that name them, guide coverage emptied and refilled without anyone noticing, and the folded-assertion count returned after a PR drove it down. When you build the measure, wire it to a check in the same change, and fix the total rather than a per-file exemption list, because an exemption list is the thing that never shrinks.

**A new compiler obligation is first a claim about every existing fixture.** A gate the compiler did not have is a gate no fixture was written against, so the first run after adding one reports defects the fixtures were already carrying. Read each as a finding about the fixture before treating it as evidence the gate is too strict; a fixture is the cheapest place a real contradiction shows up.

## Coverage is 100% on what you write

**Every executable position on a line a change writes ends at 100% on statements, branches, functions, and lines.** That is the obligation, it is per change, and it is not negotiable by difficulty. A whole new file is every line of it.

The repository total is a different number and always has been, for a reason worth keeping here rather than in a workflow file: the whole measured set has never met 100%, a permanently red job told nobody anything, and it buried real regressions in the same colour. So the repository carries inherited gaps in files nobody has touched, and closing them is its own work rather than a toll on the next unrelated change.

The demand used to be the whole of any file a change touched, and that headline and this paragraph gave different answers on a real file: `packages/template/scaffold/scripts/capture-browser.ts` took three lines of edit; one import source and two message strings; and carries 1,322 statements, so the file rule asked for all 1,322. A toll like that is not strictness. It prices the cheapest correct move, opening a large untested file to fix one line, above leaving the line wrong, and it buys nothing, because the 1,319 statements nobody touched are no better tested after it is paid.

Code a change makes newly reachable is not lost to the narrower rule, and needs no judgment about reachability. It follows from the demand: a changed line routing into code nothing ran before must be covered in every branch it carries, and covering it runs what it routes into. What is given up is a position that ran before the change and stops running after it on a line the change did not touch; catching that needs a second full suite at the merge base, an hour of CI for what a failing test reports first.

What that means in practice:

- A position is yours when the change occupies any line of its span, not only the line the span opens on. Editing the middle of a multi-line statement is editing that statement.
- Do not treat an inherited gap in a file you never opened as your obligation, and do not report the repository total as if it were your result. The gate prints what it excused, per file, as `INHERITED GAP:` on a passing run; read that line rather than assuming a green run measured everything in the file.
- Report the per-file numbers for the files you own, with the command and the moment you measured them.

The measured set is authored executable TypeScript in runtime library packages, as declared by `test/src/coverage/coverageInstrumentPopulation`. Five categories sit outside it and each is a decision rather than an oversight: `packages/template/scaffold/` and `packages/playground/` are shipped material a generated project runs, not this repository; `packages/cli/` is command orchestration with no repository-side process test; `packages/evidence/` is the build-time contract compiler whose former repository-shape tests were removed; root `build/` and package-local build directories are packaging tooling; and `test/src/coverage`, `test/src/integrity`, lint/vite configurations, and evidence exclusion lists are test or configuration machinery rather than product runtime. Their correctness is settled by the checks they run and by focused logic tests where a pure decision exists, not by recursively demanding coverage of the gate from the process the gate launches. `isAuthoredExecutableSource` and the instrument arguments are two spellings of one rule, and the population gate refuses them when they disagree. The measure runs with `--all`, so a runtime source no test imports is reported rather than silently absent; test scenarios and fixtures, generated outputs, declarations, and the established `index.ts` and `bin.ts` entry barrels are the closed exclusions. Measure with `pnpm --filter @automovie/test coverage`: this single typed command runs the c8 suite, prints the inherited gap report, and then refuses any base-to-final changed line whose statements, branches, and functions are not 100% or whose exact source snapshot was not instrumented. The raw records, report, and source-identity sidecars form one run-private publication passed explicitly to every consumer; an incomplete or internally inconsistent measurement exits with instrument status 2 and is never published. c8 writes only under `node_modules/.cache/`; an absolute `/tmp` path silently measured nothing on Windows. Never leave `coverage/` or `.nyc_output/` in the tree, and never paper over them with `.gitignore`.

Read the historical output from `test/src/coverage/reportCoverageGaps.ts` knowing what it can and cannot say, because a list that looks exact is how it misleads. Two classes of entry are dropped before you see them, both provable: a zero-hit function whose complete name, declaration span, and location span exactly match a covered entry in the same file, and a name the file never contains, which is a helper the transpile emitted. The report says how many it dropped. A same-name function at a different declaration remains a gap. Only complete line-and-column spans are reconciliation identities; an incomplete or ambiguous position fails the measurement instead of borrowing coverage from a nearby entry. The one thing the report itself refuses outright is a position past the end of the file **as measured**, which exits non-zero, because nothing in the source sits there to be left untested. That check needs the measurement sidecars beside the report; without them the reporter says how many files it could not check, and the touched-file gate refuses to judge a source against coverage of different bytes.

A zero-percent reading is three different facts wearing one number, and the run now separates them before you chase any of them. `NO PROCESS LOADED:` names a measured source no record mentions, which is the only honest reading of nothing running it. `MEASURED SOURCE GONE AT REPORT TIME:` names one a process did load and the report could not read back, because the file was addressed somewhere that no longer exists. `UNION SHORTFALL:` names a file the shape fold wrote without an exact covered position identity one of its readings had. What is left after those three is ordinary untested code. Four separate ways of guessing which kind a gap was gave four different answers on the same files before these lines existed; read the lines instead.

A whole-suite per-file figure is a lower bound, and a scoped run over the same file is the exact one. Measured on this repository: a geometry-scoped run reports `tessellate.ts` at 226/226 statements where the full suite reports 172/226, same source and same denominator, and the full run's entry carries two extra function entries naming two of its own functions at a line that defines neither, with zero hits. The measurement says how often that happened: `coverage shapes: 339 scripts were read by more than one process, 338 of those in more than one shape` on one run. A source loaded by a child process in a different form produces a second set of ranges, and the merge keeps both readings rather than the union. So confirm a gap with a scoped run before chasing it, and never read a full-run percentage as the amount of untested code.

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
