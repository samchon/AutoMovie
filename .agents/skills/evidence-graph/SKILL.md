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

## Derive the carrier population

Derive the complete carrier population from a source-tree glob. Never define that complete set as the union of hand-written paths.

A listed population makes "owes no evidence" the default for every file added after the list was written, and nothing reports the omission. This failure once left the MCP repaint implementation and other source files outside their package graphs while the surrounding configuration promised automatic document admission.

Write each whole-population exclusion as a negative pattern beside the positive one and state in the population's JSDoc why that file owes no package contract. The repository currently accepts three reasons: a barrel re-exports declarations that already answer at their definition, a process entry point is not a contract carrier, and a generated file is not authored. Cross every directory depth (`src/**/*.ts`), because a one-level glob admits only the top directory.

Derive a domain-partitioned population by subtraction. A specialized claim may name the stable files assigned to its domain, but one residual claim starts from the complete source glob and subtracts those assignments. A new source then answers for the residual domain until someone deliberately assigns it elsewhere. Pattern order decides the result: `@ttsc/evidence` evaluates left to right and a later positive pattern re-admits what an earlier negative removed, so a claim that adds one file back to a residual writes it after the spread rather than before it.

A derived population makes a carrier's citations checked; it does not make citations mandatory. `evidence/graph` runs its obligation from the reference toward the claim, so a new file carrying a wrong citation is an error while a new file carrying none at all is silent. `singleEvidencePerSymbol` does not close that gap, because it demands exactly one unit per host where this repository's hosts answer for several. Until the contributor grows a per-host lower bound, that bound belongs to a structural guard, and `#1900` deliberately removed the repository-shape test class that would host one. Record the unpaid edge instead of reporting the population as self-enforcing.

## Declare one owner per contract unit

The positive edge families prove that a unit has a claimant or a disclaimer. They cannot separate a promise project source owns by design from a promise nobody took, because both are spelled as one exclusion per package. `docs/contract-ownership/requirements.json` and `specifications.json` carry that missing statement, and `internals/contract-ownership.mjs` checks it.

Declare exactly one owner per requirement unit and per specification obligation. A `package` owner names the workspace package that answers, and the gate requires that package to already carry a positive `@evidence` for the same target, so the ledger never invents an owner the native graph does not know. A `project-source` owner names the specification obligations the product supplies so an author can discharge it, and the gate walks those supplies until each one terminates at a package-owned obligation, rejecting a missing target, a cycle, and a path that ends in an exclusion. An obligation handed to an author with no product supply is an omission with a sentence in front of it, not an assignment. An `excluded` owner records the decided boundary once with a non-empty reason instead of repeating a disclaimer in every package.

Split a specification unit into obligations rather than letting several partial claimants add up to a false whole. A package that owns one obligation writes `@evidencePart <unit>::<obligation-id>` in the same JSDoc block as its `@evidence <unit>`, so the part claim refines the native triangle instead of replacing it.

Migrate rather than re-baseline. Initialization snapshots the existing corpus into `legacy` and refuses to overwrite a ledger that exists, so accrued debt cannot be laundered by taking a fresh snapshot. What the gate refuses afterwards is a decision somebody made: a unit that appears with no owner, and a ledger entry whose unit is gone. The debt can therefore shrink or hold, never quietly grow.

Count drift, do not refuse it. A legacy unit is exactly the unit nobody has been able to assign, so failing an unrelated prose edit until someone names an owner buys a declaration written to clear a diagnostic, and a manufactured owner is worse than a counted debt. The check reports `stale` beside `legacy` for the units whose prose moved since the snapshot. `node internals/contract-ownership.mjs query --layer requirements --owner <package|project-source|excluded|legacy>` answers who owns what without reading prose.

## Partition a unit that several claimants share

`evidence/graph` proves that a unit has a claimant. It does not prove that its claimants together cover the unit, so a unit one third implemented and a unit fully implemented pass identically. Prose that narrows a claim (`it does not claim camera-body clearance`) is honest and unparsed: no tool reads it, and one resolved citation counts the whole unit as realized.

No `@ttsc/evidence` option closes this. `evidence/graph` runs its obligation from the reference toward the claim, `singleEvidencePerSymbol` demands exactly one unit per host where this repository's hosts answer for several, and `uniqueEvidence` would manufacture a false sole owner for shared implementation. Treat fragment coverage as a repository mechanism rather than a lint setting you have not found yet.

Declare the partition in two places that answer two different questions. The specification unit enumerates its own fragments with `<!-- @evidenceObligation <id> <what the fragment is> -->` markers, because deciding where one obligation ends is human judgment that belongs beside the prose it divides. The ledger under `docs/contract-ownership/` then answers who owns each id, because ownership must be queryable without parsing prose. A package owner proves the fragment by carrying `@evidence <unit>` and `@evidencePart <unit>::<id>` in one JSDoc block; two separate blocks do not aggregate into a claim.

Split a fragment whenever the product implements part of a noun and not the rest. `{#clv-clipping-clearance-evaluation}` lists `delivery crop` as one input, and the engine applies the delivery raster's width and height while nothing applies a crop region narrower than that raster, so the unit enumerates `delivery-raster-extent` and `delivery-crop-region` separately and only the first has an owner. Merging them would hide the missing half behind a true sentence about the present one, which is the failure this partition exists to end.

Leave a fragment nobody implements undeclared rather than excluding it. An exclusion states that the claim intentionally owes nothing, so spending one on unfinished work restores the exact confusion between a decided boundary and an unexamined gap. An enumerated fragment with no ledger entry is visible debt; an exclusion over it is a false statement that reads green forever.

Migrate by touching. Every unit starts in the ledger's `legacy` snapshot with its digest, and editing that unit moves its prose away from the digest, which is what surfaces it to the next author of that unit rather than arriving as one repository-wide red gate. What surfaces is a number, not a refusal: the check reports it under `stale` and still exits zero, exactly as the counting rule above requires. Read that count when you touch a legacy unit and decide whether this is the change that should declare its owners; nothing will stop you either way, and a declaration written to clear a diagnostic is the outcome the counting rule exists to avoid.

**Unpaid edge.** Nothing yet compares a unit's marker set against its declared obligation set, so a declaration can still cover five of nine fragments and pass. Until that comparison exists, read the markers when you review a declaration, and do not report a passing gate as proof that a unit is fully owned.

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

For a carrier-population change, probe the population itself: add a source file the change is supposed to admit, give it a citation to an anchor that does not exist, and confirm the diagnostic names that file. Then delist the file and confirm the same citation goes silent. Without the second half the probe proves the rule works, not that the population changed. Delete the probe and re-run before reporting either result.

Inspect the Markdown and agent-instruction diff directly, then run `git diff --check`. If a required graph command cannot run because the staged contract is intentionally incomplete, report the exact unpaid edge population rather than calling the graph verified.
