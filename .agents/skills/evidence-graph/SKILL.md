---
name: evidence-graph
description: Defines automovie's committed trace from product requirements through package-independent system specifications to public TypeScript exports, plus the separate reusable generated-production contract targets under packages/template/scaffold/docs and packages/template/language-contracts. Covers their distinct @ttsc/evidence populations, citations, exclusions, README participation, and stable anchors, plus repository-triangle reachability validation. Use before adding, moving, or reviewing those contract sources, changing public-export evidence JSDoc, or adding or reshaping repository evidence lint configuration and structural guards. For a generated production's graph, also use the evidence-graph skill that ships in the scaffold. Do not use this for frame-review evidence, design-reference evidence, or provenance records that do not use @ttsc/evidence.
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

When writing or revising the reusable production targets under `packages/template/scaffold/docs` or `packages/template/language-contracts`, read the [shared production-contract source pool](references.md) before searching anew. It records which durable source settles which kind of question without coupling sources to the contract anchors that happen to cite them today. Verify every selected link and used passage again before citation.

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

## Derive the carrier population

Derive the complete carrier population from a source-tree glob. Never define that complete set as the union of hand-written paths.

A listed population makes "owes no evidence" the default for every file added after the list was written, and nothing reports the omission. This failure once left the repaint implementation and other source files outside their package graphs while the surrounding configuration promised automatic document admission.

Write each whole-population exclusion as a negative pattern beside the positive one and state in the population's JSDoc why that file owes no package contract. The repository currently accepts three reasons: a barrel re-exports declarations that already answer at their definition, a process entry point is not a contract carrier, and a generated file is not authored. Cross every directory depth (`src/**/*.ts`), because a one-level glob admits only the top directory.

Derive a domain-partitioned population by subtraction. A specialized claim may name the stable files assigned to its domain, but one residual claim starts from the complete source glob and subtracts those assignments. A new source then answers for the residual domain until someone deliberately assigns it elsewhere. Pattern order decides the result: `@ttsc/evidence` evaluates left to right and a later positive pattern re-admits what an earlier negative removed, so a claim that adds one file back to a residual writes it after the spread rather than before it.

A derived population makes a carrier's citations checked; it does not make citations mandatory. `evidence/graph` runs its obligation from the reference toward the claim, so a new file carrying a wrong citation is an error while a new file carrying none at all is silent. `singleEvidencePerSymbol` does not close that gap, because it demands exactly one unit per host where this repository's hosts answer for several. Do not replace that missing semantic judgment with a repository-shape test that reads source paths or counts current citations. Self-Review must inspect every changed public carrier and reject an unpaid one from the actual contract it implements.

## Every public package participates

`@automovie/production` and `@automovie/playground` carry the same repository `evidence/graph`, `evidence/documented`, and `evidence/todo` obligations as the other public packages. Production owns the compiler, project store, capture, inspection, and render-job contracts it implements. Playground owns the durable prototype-view surface it exports. Neither a removed transport boundary nor an application's smaller surface excuses its public exports from requirement and specification traceability.

## Split independently payable units

`evidence/graph` proves that a requirement or specification unit has a claimant. It does not prove that several partial claimants add up to the complete unit. When behaviors can mature, fail, or be implemented independently, give each one its own H3 with a stable anchor and let the native requirement or specification to claim to public-export triangle validate it directly.

Do not create a parallel fragment grammar, carrier tag, or ownership ledger. Those auxiliary records duplicate the Markdown unit and source citation identities, drift when either side changes, and still cannot prove semantic completeness. If several packages genuinely implement one inseparable unit, every positive citation must truthfully implement that complete unit. If none does, the unit is too broad and must be split before it is cited.

Leave a unit nobody implements without a positive public carrier rather than excluding it. An exclusion states that the selected claim intentionally owes nothing; spending one on unfinished work confuses a decided package boundary with an unexamined product gap.

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

Make every reason state why this claimant answers for that target. A restatement of the heading, an ownership assertion, or a sentence written only to silence a diagnostic is not a reason. Test it by exchange: read this claimant's sentence against a sibling that answers the same target, and the sibling's against this one. If neither becomes false, neither was written about the export it sits on. Counting the export's members or lines describes its size rather than what the target required, and a statement about how something is written; an identifier, a number, a path; must use the export's own rendering, because reading the export is the only check this graph has.

Use `@evidenceExclude` only when the selected claim intentionally owes no relationship to the target. State the specific boundary and why no implementation belongs there. An exclusion is not positive implementation evidence and must not satisfy a reference configured with `noEvidenceExclude`.

Preserve `@evidenceReview` and `@evidenceExcludeReview` when a reference requires review. Treat an expired fingerprint as a request to inspect the cited content again, not as a value to copy without review.

## Repository evidence review companions

Keep `evidence/review` disabled on the repository requirement-specification-source graph. Its complete source population carries enough relationships that one companion review sentence per positive or excluded edge becomes repeated package-boundary acknowledgement rather than semantic inspection. No gate currently refuses a lint configuration that changes this decision.

The substitute controls divide what can be automated from what cannot. `evidence/graph`, `evidence/documented`, and `evidence/todo` validate populations, resolution, carriers, and declared unrealized work; the development skill owns tests and changed-position coverage; the review skill owns semantic inspection of the actual host, target, reason, and consequence. None of those tools proves prose meaning automatically, so a passing graph never replaces Self-Review.

The generated-production graph is separate. Its review stage records substantive relationship inspections over the production's selected authored population and remains active under the scaffold's shipped evidence-graph and review-verification skills. Reconsider the repository rule when a mechanism can select changed semantic relationships, preserve concrete observations, and reject copied acknowledgements without demanding a companion sentence for every stable edge.

## Change workflow

1. Read the documentation skill and update `.wiki/` as the decision develops. Read the project skill for product scope, the development skill for source or test changes, the scaffold skill when the shared contract inventory or the scaffold harness changes, and the scaffold's shipped evidence-graph skill when a production's own graph is involved.
2. Inspect the current typed `lint.config.ts` files, workspace scripts, structural tests, installed `@ttsc/evidence` README and type declarations, and every affected citation. Do not treat an archived branch or an earlier decision as the active implementation.
3. Classify each statement as requirement, specification, package usage, public API contract, research, or working knowledge before choosing its home. For a reusable production discovery, upstream, principle, or obligation target, check [the shared source pool](references.md) before searching anew and verify every selected link directly.
4. Describe each claim-reference pair as one sentence before configuring it. If the sentence does not match the selected files and symbol kinds, correct the population.
5. Add or revise the contract text, stable anchors, and positive citations together. Preserve direct requirement and specification citations on every affected public source symbol.
6. Trace every affected source triangle from resolved units. Add or update the structural guard when native lint does not prove README inclusion, specification-host and public-source-host lower bounds, anchor uniqueness, or transitive reachability.
7. Run the narrowest graph checks, then Self-Review the whole declared evidence surface under the review skill.

## Interpret failures

Treat a missing acknowledgement as an unpaid relationship. Build the missing artifact or add a truthful citation from the artifact that already answers for it. Do not add an exclusion or unrelated citation only to make the build green.

Treat a dangling target as contract drift. Find whether the document, anchor, root, glob, or symbol identity moved, then update every real dependent or restore the stable identity.

Treat an uncovered requirement during requirements-first work as visible implementation debt. A deliberately red graph is more accurate than a false specification or source citation. Record the phase and debt in `.wiki/` and the pull request instead of weakening the permanent rule.

The scaffold production ladder is a separate graph with its own populations and topology. Its exact reusable target corpus includes discovery, principles, obligations, upstream revision, and the selected language module. Discovery is file-level coverage over the flat `docs/contracts/*.md` population, with one claim for each active authored Markdown layer. Upstream revision is an exclusion-permitted unit checklist over each inheriting authored or source population. A retained discovery result belongs in the contract file that states the adopted rule and an additive claim enforces it; a true no-result receives one concrete population-wide exclusion only in `docs/contracts/index.md`. Authored H2, H3, and H4 units never host the discovery audit. Apply this skill's citation honesty and lint-inspection rules there, but use the scaffold's `contract`, `production-lifecycle`, `evidence-graph`, `source-authoring`, and `review-verification` skills to decide which canonical question, procedure, and stage answers each target. Do not impose the repository requirement-specification-source triangle on generated productions.

## Verify

Run the configured `ttsc --noEmit` or package build for every affected claim project. When the repository docs workspace exists, run its declared lint script; when package source citations change, run the owning package build.

Run the structural tests that cover contract globs, README participation, explicit unique anchors, public source citations to both document layers, and triangular reachability. For a graph-configuration change, perform disposable negative probes for a missing specification edge, a missing source-to-requirement edge, a missing source-to-specification edge, and a mismatched triangle. Restore the tree after each probe and confirm the expected diagnostic came from the intended rule.

For a carrier-population change, probe the population itself: add a source file the change is supposed to admit, give it a citation to an anchor that does not exist, and confirm the diagnostic names that file. Then delist the file and confirm the same citation goes silent. Without the second half the probe proves the rule works, not that the population changed. Delete the probe and re-run before reporting either result.

Inspect the Markdown and agent-instruction diff directly, then run `git diff --check`. If a required graph command cannot run because the staged contract is intentionally incomplete, report the exact unpaid edge population rather than calling the graph verified.
