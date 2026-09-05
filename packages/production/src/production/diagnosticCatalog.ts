import {
  AUTOMOVIE_DIAGNOSTIC_CODES,
  AutoMovieDiagnosticCode,
  IAutoMovieDiagnosticReference,
} from "@automovie/interface";

const CATALOG_REVISION = 2;

interface IDiagnosticFamilyContract {
  path: IAutoMovieDiagnosticReference["path"];
  invariant: string;
  correction: string;
  recheck: string;
}

/**
 * One immutable behavioral explanation delivered for a closed diagnostic code.
 */
export interface IAutoMovieDiagnosticCatalogEntry {
  /**
   * Closed diagnostic identity resolved by this entry.
   */
  readonly code: AutoMovieDiagnosticCode;
  /**
   * Stable, versioned behavioral-reference identity and skill-document anchor.
   */
  readonly reference: Readonly<IAutoMovieDiagnosticReference>;
  /**
   * Contract family the reported occurrence failed to satisfy.
   */
  readonly invariant: string;
  /**
   * User-owned recovery boundary; this catalog never applies it.
   */
  readonly correction: string;
  /**
   * Operation whose fresh result decides whether correction succeeded.
   */
  readonly recheck: string;
}

const FAMILY_CONTRACTS: Readonly<Record<string, IDiagnosticFamilyContract>> = {
  acceptance: {
    path: ".agents/skills/evidence-graph/contract-targets.md#shared-form",
    invariant:
      "Acceptance outcomes must be derived from current, addressable criteria and current compiled observations.",
    correction:
      "Read the occurrence message and edit the user-owned acceptance or story contract it identifies; the catalog does not synthesize a criterion or result.",
    recheck:
      "Compile the same scope again and re-evaluate the named criterion.",
  },
  asset: {
    path: ".agents/skills/source-authoring/models-and-motions.md#model-decisions",
    invariant:
      "Every adopted asset must resolve to declared bytes, interpretation metadata, provenance, permission, and a supported consumer representation.",
    correction:
      "Read the occurrence target, path, and message, then repair or replace the user-selected asset record without changing provider or content policy implicitly.",
    recheck: "Inspect the adopted bytes again and compile the same scope.",
  },
  blocking: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Authored blocking must lower to valid deterministic stage relations for the registered shot contract.",
    correction:
      "Correct the blocking operation named by the occurrence without replacing the author's staging decision.",
    recheck: "Execute the shot source and compile the affected shot again.",
  },
  builder: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "A shot builder must execute successfully inside the deterministic source boundary.",
    correction:
      "Repair the exact authored builder failure reported by the occurrence without bypassing the compiler boundary.",
    recheck: "Execute the same source registration and compile scope again.",
  },
  capture: {
    path: ".agents/skills/review-verification/capture.md#request",
    invariant:
      "A review capture must reopen as current host-produced pixels bound to the exact production, target, renderer, and compile fingerprint.",
    correction:
      "Follow the occurrence message to restore the named host, registration, input, or receipt; never treat a refused capture as evidence.",
    recheck:
      "Retry the same capture request after recompiling any changed source.",
  },
  compile: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Compilation consumes one current, stable input closure and publishes derived state only after the requested scope succeeds.",
    correction:
      "Use the occurrence message to correct the identified input or rerun after the concurrent change; no catalog lookup edits the project.",
    recheck: "Run the same compile scope against one unchanged input revision.",
  },
  content: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Compiler input must remain inside the declared deterministic and security boundary.",
    correction:
      "Remove or replace the exact unsafe input named by the occurrence under the production author's policy.",
    recheck: "Run the same source or compile validation again.",
  },
  contract: {
    path: ".agents/skills/evidence-graph/contract-targets.md#shared-form",
    invariant:
      "The registered shot and its realized source must agree with one exact authored contract.",
    correction:
      "Correct the contract or source relation named by the occurrence; the compiler does not rewrite either side to make them agree.",
    recheck:
      "Compile the affected shot and re-evaluate all contract realizations.",
  },
  design: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Tracked design must be complete, internally consistent, addressable, and supported before downstream compilation can consume it.",
    correction:
      "Correct the exact design owner, field, or reference named by the occurrence; do not invent content, providers, or fallback values.",
    recheck:
      "Validate design scope first, then repeat every invalidated downstream scope.",
  },
  derived: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Every derived artifact must have one current, portable, project-owned generator, dependency closure, ledger record, and exact output before source execution.",
    correction:
      "Correct the generator or declared input named by the occurrence and rerun the explicit generation command; do not edit the ledger or output bytes by hand.",
    recheck:
      "Inspect the derived-artifact ledger again, then compile the same scope without changing its input closure.",
  },
  engine: {
    path: ".agents/skills/review-verification/debugging.md#triage-order",
    invariant:
      "Engine validation must succeed before its output can be accepted as compiled production state.",
    correction:
      "Inspect the nested engine failure in the occurrence and repair the authored geometry, motion, timing, or bounded state it names.",
    recheck: "Run engine validation and then the same compile scope.",
  },
  environment: {
    path: ".agents/skills/source-authoring/design-branches.md#design-branches",
    invariant:
      "Environment context must name valid authored spatial owners and may not derive physical facts from labels or appearance.",
    correction:
      "Correct the explicit world, building, space, or material fact named by the occurrence; do not infer a missing physical parameter.",
    recheck:
      "Validate the environment and repeat the consuming compile operation.",
  },
  film: {
    path: ".agents/skills/source-authoring/editing.md#choose-the-cut",
    invariant:
      "The compiled film must account for every selected shot, transition, cue, clock join, and deliverable interval on one exact timeline.",
    correction:
      "Correct the user-authored film or shot timing relation identified by the occurrence without silently selecting an edit.",
    recheck: "Compile the film again and revalidate its complete timeline.",
  },
  generated: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Compiler-owned generated output must exactly match the current source closure and its manifest.",
    correction:
      "Repair tracked source or remove only the specifically diagnosed stale generated artifact through the documented compiler workflow.",
    recheck: "Run the owning compile or read-only lint operation again.",
  },
  geometry: {
    path: ".agents/skills/source-authoring/rigging.md#silhouette-first-recipe",
    invariant:
      "Geometry queries must use supported selectors that resolve inside the current compiled production.",
    correction:
      "Correct the selector or its tracked owner named by the occurrence; do not substitute a guessed measurement.",
    recheck: "Repeat the same geometry query against current compiled state.",
  },
  grammar: {
    path: ".agents/skills/production-lifecycle/screenplays.md#gate",
    invariant:
      "Authored style intent must account for deliberate film-grammar departures observed in the compiled result.",
    correction:
      "Re-author the shot or its explicit style intent; the diagnostic does not choose the creative resolution.",
    recheck: "Compile and review the affected shot and film relation again.",
  },
  legacy: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Legacy import must preserve source, disclose every default or reconstruction, and refuse facts that cannot be recovered.",
    correction:
      "Resolve the named reconstruction decision in tracked user-owned design or supply the missing legacy source.",
    recheck:
      "Repeat import, reopen the project, and compile the affected scopes.",
  },
  model: {
    path: ".agents/skills/source-authoring/models-and-motions.md#model-decisions",
    invariant:
      "A model recipe must use a registered archetype and supported, bounded parameter contract.",
    correction:
      "Correct the named recipe or explicitly choose another registered archetype; the catalog never selects one.",
    recheck: "Validate design and materialize the model again.",
  },
  performance: {
    path: ".agents/skills/source-authoring/motion.md#define-the-action",
    invariant:
      "Authored performance must lower to supported deterministic pose, motion, expression, and timing state.",
    correction:
      "Correct the named performance input while leaving creative motion and external-take selection with the author.",
    recheck: "Execute the performance and compile the affected shot again.",
  },
  pipeline: {
    path: ".agents/skills/review-verification/debugging.md#triage-order",
    invariant:
      "The deterministic source-to-film pipeline must complete before its result can be accepted.",
    correction:
      "Inspect the nested pipeline failure and repair its owning tracked source or design input.",
    recheck: "Run the same pipeline and compile scope again.",
  },
  preview: {
    path: ".agents/skills/review-verification/capture.md#request",
    invariant:
      "Preview may render only a valid, current, registered target under the host capture contract.",
    correction:
      "Correct or compile the target named by the occurrence before asking the host to capture it.",
    recheck: "Repeat the same preview or capture request.",
  },
  production: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Every operation must remain bound to one registered production namespace and its current addressable state.",
    correction:
      "Use the occurrence target and message to select or register the intended production explicitly.",
    recheck: "Reopen the named production and retry the same operation.",
  },
  registration: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Source registration must bind the declared production, shot, and export identities exactly once.",
    correction:
      "Correct the explicit registration named by the occurrence without guessing an alternate production or shot.",
    recheck: "Load the source and compile its registered target again.",
  },
  render: {
    path: ".agents/skills/source-authoring/compilation.md#a-clean-compile-is-not-a-look",
    invariant:
      "Rendered delivery must be complete, current, byte-verified, media-verified, and owned by its exact production input.",
    correction:
      "Repair or regenerate the exact rendition or receipt named by the occurrence; never accept a path or label as proof.",
    recheck: "Render again if required, then run the same final verification.",
  },
  repaint: {
    path: ".agents/skills/review-verification/capture.md#request",
    invariant:
      "Optional repaint may consume only current reviewed source pixels, declared controls, references, provider facts, and immutable receipts.",
    correction:
      "Resolve the exact eligibility, host, evidence, or receipt failure named by the occurrence without choosing a provider or candidate automatically.",
    recheck:
      "Repeat the same repaint request after its declared prerequisites are current.",
  },
  review: {
    path: ".agents/skills/review-verification/review.md#evidence-review",
    invariant:
      "A reviewed target must hold the evidence its own contract declares, captured at the target's current identity.",
    correction:
      "Capture the declared frames the occurrence names, then state what they showed in the evidence citation on the source that realizes the target; nothing decides the verdict on the reviewer's behalf.",
    recheck: "Compile the same scope again and confirm the occurrence is gone.",
  },
  screenplay: {
    path: ".agents/skills/production-lifecycle/screenplays.md#gate",
    invariant:
      "The screenplay ladder must preserve unique identities, ordered coverage, evidence ownership, locks, and explicit omissions from intent to scene.",
    correction:
      "Correct the named screenplay document or relation while preserving author ownership of story content.",
    recheck:
      "Run screenplay lint and compile every affected scene relation again.",
  },
  source: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Tracked source must export the registered deterministic contract and stay inside the compiler sandbox and ownership boundary.",
    correction:
      "Correct the exact module, export, capability, or registration named by the occurrence without bypassing the sandbox.",
    recheck: "Run source lint and the same compile scope again.",
  },
  stage: {
    path: ".agents/skills/source-authoring/ownership.md#source-ownership",
    invariant:
      "Authored stage state must remain valid, bounded, and consumable by the deterministic pipeline.",
    correction:
      "Correct the exact authored stage fact named by the occurrence without substituting inferred scene content.",
    recheck: "Execute stage construction and compile the affected shot again.",
  },
};

const CODE_CONTRACTS: Readonly<
  Partial<Record<AutoMovieDiagnosticCode, IDiagnosticFamilyContract>>
> = {
  "repaint-claim-refused": {
    path: ".agents/skills/review-verification/capture.md#request",
    invariant:
      "One immutable repaint request prefix dispatches to the provider at most once at a time: an unsettled or unknown-outcome claim closes that prefix until its owner settles, and a moved journal or claim generation is replanned rather than dispatched.",
    correction:
      "Read the refusal's cause. Wait for an active owner to settle; after an unknown provider outcome reconcile the provider side and author a new request identity instead of retrying this one; after a moved prefix rerun the same repaint so it plans against the current journal.",
    recheck:
      "Run the repaint again and confirm the request either dispatches or names a different, current cause.",
  },
  "source-scene-coverage-incomplete": {
    path: ".agents/skills/source-authoring/design-branches.md#design-branches",
    invariant:
      "Authored scene content must cover what it claims to cover: a declared region owes its membrane, its fall and a drain the fall reaches, and a declared opening owes a run that uses it.",
    correction:
      "Cover the region or use the opening the occurrence names, or withdraw the claim; a warning here states a gap to decide about rather than a value to fix.",
    recheck:
      "Compile the same shot again and read the named record's findings.",
  },
  "source-scene-physics-invalid": {
    path: ".agents/skills/source-authoring/design-branches.md#design-branches",
    invariant:
      "Authored scene content must be physically possible in the space it is placed in: two bodies may not occupy one volume, and nothing may stand in the access a maintainable thing declares it needs.",
    correction:
      "Move one of the two bodies the occurrence names, or change the volume one of them claims; correcting a coordinate elsewhere in the record does not resolve a conflict between these two.",
    recheck:
      "Compile the same shot again and confirm the named pair no longer shares a volume.",
  },
  "review-outcome-artifact-malformed": {
    path: ".agents/skills/review-verification/review.md#evidence-review",
    invariant:
      "A current compiler-owned acceptance artifact must remain readable, digest-matched UTF-8 JSON before review can derive an outcome from it.",
    correction:
      "Remove only the damaged compiler-owned publication named by the occurrence, then compile the same current inputs again; do not edit an acceptance outcome by hand.",
    recheck:
      "Prepare the same review again and confirm the named artifact reads under its current manifest digest.",
  },
  "review-outcome-artifact-missing": {
    path: ".agents/skills/review-verification/review.md#evidence-review",
    invariant:
      "Every manifest-owned acceptance artifact required by a current compile must be resident before review derives an outcome.",
    correction:
      "Compile the same current inputs to restore the missing compiler-owned publication named by the occurrence.",
    recheck:
      "Prepare the same review again and confirm the named artifact is resident under the current generated manifest.",
  },
  "review-outcome-contract-mismatch": {
    path: ".agents/skills/review-verification/review.md#evidence-review",
    invariant:
      "The compiler writer and review reader shipped in one revision must agree on the exact schema and identity of every acceptance artifact.",
    correction:
      "Report the artifact path and validator paths as an internal compiler-reader contract defect; do not change author-owned source or repeat an unchanged compile as a purported fix.",
    recheck:
      "After the product contract is corrected, compile and prepare the same review again against one unchanged input revision.",
  },
};

const createCatalogEntry = (
  code: AutoMovieDiagnosticCode,
): Readonly<IAutoMovieDiagnosticCatalogEntry> => {
  const family = code.slice(0, code.indexOf("-"));
  const contract = CODE_CONTRACTS[code] ?? FAMILY_CONTRACTS[family];
  if (contract === undefined)
    throw new Error(`Diagnostic code "${code}" has no behavioral family.`);
  return Object.freeze({
    code,
    reference: Object.freeze({
      catalogRevision: CATALOG_REVISION,
      id: `automovie-diagnostic/${code}`,
      path: contract.path,
    }),
    invariant: contract.invariant,
    correction: contract.correction,
    recheck: contract.recheck,
  });
};

const DIAGNOSTIC_CATALOG = Object.freeze(
  AUTOMOVIE_DIAGNOSTIC_CODES.map(createCatalogEntry),
);
const DIAGNOSTIC_CATALOG_BY_CODE = new Map(
  DIAGNOSTIC_CATALOG.map((entry) => [entry.code, entry] as const),
);

/**
 * List the complete immutable diagnostic catalog in canonical code order.
 *
 * The lookup is descriptive and read-only. It neither edits production source
 * nor applies the returned correction.
 */
export const listAutoMovieDiagnosticCatalog =
  (): readonly Readonly<IAutoMovieDiagnosticCatalogEntry>[] =>
    DIAGNOSTIC_CATALOG;

/**
 * Resolve one diagnostic code without changing project or catalog state.
 */
export const findAutoMovieDiagnosticCatalogEntry = (
  code: string,
): Readonly<IAutoMovieDiagnosticCatalogEntry> | null =>
  DIAGNOSTIC_CATALOG_BY_CODE.get(code as AutoMovieDiagnosticCode) ?? null;
