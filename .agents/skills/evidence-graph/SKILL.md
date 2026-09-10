---
name: evidence-graph
description: Defines automovie's committed trace from product requirements through package-independent system specifications to public TypeScript exports, plus the separate reusable generated-production contract targets under packages/template/scaffold/docs and packages/template/language-contracts. Covers their distinct @ttsc/evidence populations, citations, exclusions, README participation, stable anchors, and repository-triangle review. Use before adding, moving, or reviewing those contract sources, changing public-export evidence JSDoc, or adding or reshaping repository evidence lint configuration. For a generated production's graph, also use the evidence-graph skill that ships in the scaffold. Do not use this for frame-review evidence, design-reference evidence, or provenance records that do not use @ttsc/evidence.
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

Select the complete public export surface rather than narrowing files or symbol kinds to avoid obligations. Enable `evidence/documented` for that surface so every exported symbol has a JSDoc carrier. Configure both graph relationships and inspect every affected implementation export for truthful direct citations to both document layers.

For each direct `source -> requirement` edge, require at least one specification cited by that source to reach the same requirement through one or more configured positive specification edges. A source citing unrelated documents is not consistent merely because both citations resolve.

Trace this path in Self-Review from resolved unit identities and configured positive edges, then read the source, specification, and requirement to verify that they express the same implemented behavior. Matching words, folder names, or package ownership do not establish that relationship.

Do not set `uniqueEvidence` on a specification reference merely to manufacture an owner. Shared implementation is valid. Do not set `singleEvidencePerSymbol` where a real source symbol or specification section can answer for more than one unit. Preserve the at-least-one citation obligation without turning it into an exactly-one relationship.

## Validation responsibilities

Use each owner for the contract it actually evaluates.

| Owner | Responsibility |
| --- | --- |
| Native `@ttsc/evidence` | Evaluate the graph relationships, documentation carriers, and declared unrealized work configured through `evidence/graph`, `evidence/documented`, and `evidence/todo` in each active lint project. Use its published configuration and diagnostics as the dependency contract. |
| AutoMovie product validation | Enforce the generated production's declaration, physical population boundaries, contract inventory, stages, and topology through [`@automovie/evidence`](../../../packages/evidence/src/createAutoMovieEvidenceConfig.ts). These are production input invariants, separate from this repository's requirement-to-source graph. |
| Semantic Self-Review | Read the actual carrier, target, reason, exclusions, and downstream behavior. Confirm complete carrier selection, README participation, stable identities, both direct citation families, and the required triangle against what the implementation does. |

Keep source-text snapshots, repository-shape validators, and unpaid-host exception lists out of this workflow. Do not add a second validator to retest the native dependency. A passing configured check records that check's result; it does not establish that every product promise is implemented or that every citation is truthful.

## Derive the carrier population

Derive the complete carrier population from a source-tree glob. Never define that complete set as the union of hand-written paths.

A listed population makes "owes no evidence" the default for every file added after the list was written, and nothing reports the omission. This failure once left the repaint implementation and other source files outside their package graphs while the surrounding configuration promised automatic document admission.

Write each whole-population exclusion as a negative pattern beside the positive one and state in the population's JSDoc why that file owes no package contract. The repository currently accepts three reasons: a barrel re-exports declarations that already answer at their definition, a process entry point is not a contract carrier, and a generated file is not authored. Cross every directory depth (`src/**/*.ts`), because a one-level glob admits only the top directory.

Derive a domain-partitioned population by subtraction. A specialized claim may name the stable files assigned to its domain, but one residual claim starts from the complete source glob and subtracts those assignments. A new source then answers for the residual domain until someone deliberately assigns it elsewhere. Pattern order decides the result: `@ttsc/evidence` evaluates left to right and a later positive pattern re-admits what an earlier negative removed, so a claim that adds one file back to a residual writes it after the spread rather than before it.

A derived population selects the carriers to which the configured rules apply. Selection alone does not establish what a carrier implements. Self-Review must inspect every changed public carrier against its actual contract, require the direct citations described in [Required triangle](#required-triangle), and reject a missing or unrelated answer. Record any observed unpaid relationships with their exact reviewed population and revision; an earlier count is not a current baseline.

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

Make every reason state why this claimant answers for that target. A restatement of the heading, an ownership assertion, or a sentence written only to silence a diagnostic is not a reason. Test it by exchange: read this claimant's sentence against a sibling that answers the same target, and the sibling's against this one. If neither becomes false, neither was written about the export it sits on. Counting the export's members or lines describes its size rather than what the target required, and a statement about how something is written, such as an identifier, a number, or a path, must use the export's own rendering, because reading the export is the only check this graph has.

Use `@evidenceExclude` only when the selected claim intentionally owes no relationship to the target. State the specific boundary and why no implementation belongs there. An exclusion is not positive implementation evidence and must not satisfy a reference configured with `noEvidenceExclude`.

Preserve `@evidenceReview` and `@evidenceExcludeReview` when a reference requires review. Treat an expired fingerprint as a request to inspect the cited content again, not as a value to copy without review.

## Repository evidence review companions

Keep `evidence/review` disabled on the repository requirement-specification-source graph. Its complete source population carries enough relationships that one companion review sentence per positive or excluded edge becomes repeated package-boundary acknowledgement rather than semantic inspection. No gate currently refuses a lint configuration that changes this decision.

Apply [Validation responsibilities](#validation-responsibilities) to the repository graph. The [development skill](../development/SKILL.md) owns tests and changed-position coverage, and the [review skill](../review/SKILL.md) owns the complete semantic review procedure.

The generated-production graph is separate. Its review stage records substantive relationship inspections over the production's selected authored population and remains active under the scaffold's shipped evidence-graph and review-verification skills. Reconsider the repository rule when a mechanism can select changed semantic relationships, preserve concrete observations, and reject copied acknowledgements without demanding a companion sentence for every stable edge.

## Change workflow

1. Read the documentation skill and update `.wiki/` as the decision develops. Read the project skill for product scope, the development skill for source or test changes, the scaffold skill when the shared contract inventory or the scaffold harness changes, and the scaffold's shipped evidence-graph skill when a production's own graph is involved.
2. Inspect the current typed `lint.config.ts` files, workspace scripts and CI workflows, applicable AutoMovie product validators and their logic tests, the active `@ttsc/evidence` documentation and type declarations, and every affected citation. Do not treat an archived branch or an earlier decision as the active implementation.
3. Classify each statement as requirement, specification, package usage, public API contract, research, or working knowledge before choosing its home. For a reusable production discovery, upstream, principle, or obligation target, check [the shared source pool](references.md) before searching anew and verify every selected link directly.
4. Describe each claim-reference pair as one sentence before configuring it. If the sentence does not match the selected files and symbol kinds, correct the population.
5. Add or revise the contract text, stable anchors, and positive citations together. Preserve direct requirement and specification citations on every affected public source symbol.
6. Inspect every affected source triangle under [Required triangle](#required-triangle), including selected README units and stable anchors. Correct the actual document, citation, or claim population when it disagrees with the intended contract.
7. Follow [Verify](#verify) for the configured checks and population observations, then Self-Review the whole declared evidence surface under the review skill.

## Interpret failures

Treat a missing acknowledgement as an unpaid relationship. Build the missing artifact or add a truthful citation from the artifact that already answers for it. Do not add an exclusion or unrelated citation only to make the build green.

Treat a dangling target as contract drift. Find whether the document, anchor, root, glob, or symbol identity moved, then update every real dependent or restore the stable identity.

Treat an uncovered requirement during requirements-first work as visible implementation debt. A deliberately red graph is more accurate than a false specification or source citation. Record the phase and debt in `.wiki/` and the pull request instead of weakening the permanent rule.

The scaffold production ladder is a separate graph with its own populations and topology. Its exact reusable target corpus includes discovery, principles, obligations, upstream revision, and the selected language module. Discovery is file-level coverage over the flat `docs/contracts/*.md` population, with one claim for each active authored Markdown layer. Upstream revision is an exclusion-permitted unit checklist over each inheriting authored or source population. A retained discovery result belongs in the contract file that states the adopted rule and an additive claim enforces it; a true no-result receives one concrete population-wide exclusion only in `docs/contracts/index.md`. Authored H2, H3, and H4 units never host the discovery audit. Apply this skill's citation honesty and lint-inspection rules there, but use the scaffold's `contract`, `production-lifecycle`, `evidence-graph`, `source-authoring`, and `review-verification` skills to decide which canonical question, procedure, and stage answers each target. Do not impose the repository requirement-specification-source triangle on generated productions.

## Verify

Run the configured `ttsc --noEmit` or package build for every affected claim project. When the repository docs workspace exists, run its declared lint script; when package source citations change, run the owning package build.

For a graph-configuration change, inspect the actual roots, globs, exclusions, symbol selectors, and relationship options beside the selected contracts and exports. Confirm the claim includes the intended README roles and every affected carrier. Record the observation's revision, selected population, and native diagnostic separately from the semantic review result.

When reviewing a generated graph adapter, compare its emitted native configuration and authored declaration under the [native input projection contract](../../../docs/specifications/production-evidence/native-input.md#spec-authoring-production-evidence-native-boundary). Use the installed native types and evaluator behavior to judge this boundary.

When execution is authorized, observe a changed carrier selector through the owning project's configured native lint. Add one disposable carrier the selector is meant to admit, give it a dangling citation, and confirm that its diagnostic names that carrier. Exclude only that carrier from the changed selector and confirm the diagnostic disappears. Restore the selector and remove the disposable carrier before rerunning the normal check. This observation checks the changed repository wiring; it does not become a permanent source-text assertion or a dependency correctness suite.

Inspect the Markdown and agent-instruction diff directly, then run `git diff --check`. If a configured check or population observation cannot run, record the exact command or observation, the reason, and the remaining verification boundary in the run record and pull request. Report only unpaid relationships actually observed at the stated revision; an incomplete or unexecuted check is not a verified graph or evidence of zero debt.
