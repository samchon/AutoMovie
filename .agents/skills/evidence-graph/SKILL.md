---
name: evidence-graph
description: Defines automovie's committed contract traceability from product requirements through package-independent system specifications to public TypeScript exports, including @ttsc/evidence populations, citations, exclusions, README participation, stable anchors, and triangular reachability validation. Use before adding, moving, or reviewing requirements or specifications, changing public-export evidence JSDoc, or adding or reshaping repository evidence lint configuration and structural guards. For a generated production's screenplay ladder, also use the scaffold skill. Do not use this for frame-review evidence, design-reference evidence, or provenance records that do not use @ttsc/evidence.
---

# Evidence Graph

## Contract layers

Keep the committed contract in three distinct layers.

| Layer | Owns | Does not own |
| --- | --- | --- |
| `docs/requirements/` | Product promises a user can observe, request, or judge | Package design, symbol names, implementation procedure |
| `docs/specifications/` | System contracts that make those promises precise | Package ownership, API reference, contributor tutorial |
| Public source JSDoc | The implementation identity and why it carries its contracts | A second requirements or specifications corpus |

Write specifications around system boundaries, state, invariants, inputs, outputs, failures, and compatibility. Do not organize them by package name. One specification may be implemented by several symbols in several packages.

Do not create `docs/packages/` or `docs/modules/`. Package usage belongs in package READMEs, and exported API detail belongs in JSDoc.

Keep research and `.wiki/` outside the committed product-contract population. They justify decisions and preserve working knowledge, but a citation to research does not discharge a product promise.

## Required triangle

Configure and validate all three positive edge families:

```text
specification -> requirement
public source -> specification
public source -> requirement
```

Require every controlled requirement section to receive positive specification evidence. Require every controlled specification section to cite the requirements it makes precise. Permit only the narrow README relationship exclusions described below. Require every selected public source symbol to cite at least one requirement and at least one specification that it materially implements.

Select the complete public export surface rather than narrowing files or symbol kinds to avoid obligations. Enable `evidence/documented` for that surface so every exported symbol has a JSDoc carrier, then use the graph and structural guard to require both citation families from each implementation export.

For each direct `source -> requirement` edge, require at least one specification cited by that source to reach the same requirement through one or more configured positive specification edges. A source citing unrelated documents is not consistent merely because both citations resolve.

Do not infer this reachability from matching words, folder names, or package ownership. Validate resolved unit identities and configured edges. The installed `@ttsc/evidence` version may prove pairwise coverage without proving this cross-claim path, so add or maintain a structural guard for any invariant the contributor does not enforce itself.

Do not set `uniqueEvidence` on a specification reference merely to manufacture an owner. Shared implementation is valid. Do not set `singleEvidencePerSymbol` where a real source symbol or specification section can answer for more than one unit. Add an explicit guard for the intended lower bound instead of replacing it with an incorrect exactly-one rule.

## Stable document identities

Give every controlled H2 and H3 an explicit, unique lowercase ASCII anchor. Keep the anchor stable when prose is revised or translated so citations survive wording changes.

Select Markdown by its contract role, not by a filename exception. In the repository contract graph, README files participate like every other matching Markdown file. Never remove `README.md` from a glob because some of its sections are explanatory.

When one README section truly has no obligation in a particular claim, let an eligible claim host carry the narrowest `@evidenceExclude` for that target. Do not blanket-exclude the file or use exclusion to hide an unimplemented promise.

## Author citations

Place Markdown citations in HTML comments under the heading or at the file position that owns the claim. Place TypeScript citations in the JSDoc of the selected public export or public member.

```md
## Deterministic playback {#deterministic-playback}

<!-- @evidence requirements/playback/reproducibility.md#same-input-same-frame Defines the system invariant that realizes this promise. -->
```

```ts
/**
 * Samples one declared timeline without hidden clock state.
 *
 * @evidence requirements/playback/reproducibility.md#same-input-same-frame Produces the promised repeatable frame state.
 * @evidence specifications/time/timeline-sampling.md#fixed-clock Implements the fixed-clock sampling contract.
 */
export function sampleTimeline(): void;
```

Resolve targets from the active claim's `root`, files, and symbol selectors. Copying a path from another project or claim is not evidence that it resolves here.

Make every reason state why this claimant answers for that target. A restatement of the heading, an ownership assertion, or a sentence written only to silence a diagnostic is not a reason.

Use `@evidenceExclude` only when the selected claim intentionally owes no relationship to the target. State the specific boundary and why no implementation belongs there. An exclusion is not positive implementation evidence and must not satisfy a reference configured with `noEvidenceExclude`.

Preserve `@evidenceReview` and `@evidenceExcludeReview` when a reference requires review. Treat an expired fingerprint as a request to inspect the cited content again, not as a value to copy without review.

## Change workflow

1. Read the documentation skill and update `.wiki/` as the decision develops. Read the project skill for product scope, the development skill for source or test changes, and the scaffold skill when the generated production graph is involved.
2. Inspect the current `lint.config.ts` files, workspace scripts, structural tests, installed `@ttsc/evidence` README and type declarations, and every affected citation. Do not treat an archived branch or an earlier decision as the active implementation.
3. Classify each statement as requirement, specification, package usage, public API contract, research, or working knowledge before choosing its home.
4. Describe each claim-reference pair as one sentence before configuring it. If the sentence does not match the selected files and symbol kinds, correct the population.
5. Add or revise the contract text, stable anchors, and positive citations together. Preserve direct requirement and specification citations on every affected public source symbol.
6. Trace every affected source triangle from resolved units. Add or update the structural guard when native lint does not prove README inclusion, specification-host and public-source-host lower bounds, anchor uniqueness, or transitive reachability.
7. Run the narrowest graph checks, then Self-Review the whole declared evidence surface under the review skill.

## Interpret failures

Treat a missing acknowledgement as an unpaid relationship. Build the missing artifact or add a truthful citation from the artifact that already answers for it. Do not add an exclusion or unrelated citation only to make the build green.

Treat a dangling target as contract drift. Find whether the document, anchor, root, glob, or symbol identity moved, then update every real dependent or restore the stable identity.

Treat an uncovered requirement during requirements-first work as visible implementation debt. A deliberately red graph is more accurate than a false specification or source citation. Record the phase and debt in `.wiki/` and the pull request instead of weakening the permanent rule.

The scaffold production ladder is a separate graph with its own populations and topology. Apply this skill's citation honesty and lint-inspection rules there, but use the scaffold skill to decide which film-authoring stage answers for which other stage. Do not impose the repository requirement-specification-source triangle on generated productions.

## Verify

Run the configured `ttsc --noEmit` or package build for every affected claim project. When the repository docs workspace exists, run its declared lint script; when package source citations change, run the owning package build.

Run the structural tests that cover contract globs, README participation, explicit unique anchors, public source citations to both document layers, and triangular reachability. For a graph-configuration change, perform disposable negative probes for a missing specification edge, a missing source-to-requirement edge, a missing source-to-specification edge, and a mismatched triangle. Restore the tree after each probe and confirm the expected diagnostic came from the intended rule.

Inspect the Markdown and agent-instruction diff directly, then run `git diff --check`. If a required graph command cannot run because the staged contract is intentionally incomplete, report the exact unpaid edge population rather than calling the graph verified.
