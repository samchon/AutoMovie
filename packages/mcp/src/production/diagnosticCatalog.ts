import {
  AUTOMOVIE_DIAGNOSTIC_CODES,
  AutoMovieDiagnosticCode,
  AutoMovieProductionGuideName,
  IAutoMovieDiagnosticReference,
} from "@automovie/interface";

const CATALOG_REVISION = 1;

interface IDiagnosticFamilyContract {
  guide: AutoMovieProductionGuideName;
  path: IAutoMovieDiagnosticReference["path"];
  invariant: string;
  correction: string;
  recheck: string;
}

/**
 * One immutable behavioral explanation delivered for a closed diagnostic code.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Requires one enumerable, versioned explanation for every emitted code.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Delivers the invariant and user-owned recovery without mutating source.
 */
export interface IAutoMovieDiagnosticCatalogEntry {
  /**
   * Closed diagnostic identity resolved by this entry.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Joins actual delivery to one catalog entry.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Uses the compiler's exhaustive code union as the lookup key.
   */
  readonly code: AutoMovieDiagnosticCode;
  /**
   * Existing MCP guide that explains the owning workflow.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Keeps recovery on the user-facing knowledge surface.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Routes lookup through the existing guide delivery rather than a new tool.
   */
  readonly guide: AutoMovieProductionGuideName;
  /**
   * Stable, versioned behavioral-reference identity and guide anchor.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Gives this code exactly one behavioral reference.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Couples catalog revision, reference identity, and resolvable path.
   */
  readonly reference: Readonly<IAutoMovieDiagnosticReference>;
  /**
   * Contract family the reported occurrence failed to satisfy.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Explains the invariant behind the refusal.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Keeps the reference behavioral instead of mirroring display prose.
   */
  readonly invariant: string;
  /**
   * User-owned recovery boundary; this catalog never applies it.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Requires an actionable correction without automatic mutation.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Preserves the author or operator as correction owner.
   */
  readonly correction: string;
  /**
   * Operation whose fresh result decides whether correction succeeded.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Requires the affected consequence surface to be checked again.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Names revalidation without claiming it already ran.
   */
  readonly recheck: string;
}

const FAMILY_CONTRACTS: Readonly<Record<string, IDiagnosticFamilyContract>> = {
  acceptance: {
    guide: "ACCEPTANCE",
    path: "prompts/ACCEPTANCE.md#acceptance-scenarios",
    invariant:
      "Acceptance outcomes must be derived from current, addressable criteria and current compiled observations.",
    correction:
      "Read the occurrence message and edit the user-owned acceptance or story contract it identifies; the catalog does not synthesize a criterion or result.",
    recheck:
      "Compile the same scope again and re-evaluate the named criterion.",
  },
  asset: {
    guide: "ASSET_SOURCING",
    path: "prompts/ASSET_SOURCING.md#asset-sourcing-handbook",
    invariant:
      "Every adopted asset must resolve to declared bytes, interpretation metadata, provenance, permission, and a supported consumer representation.",
    correction:
      "Read the occurrence target, path, and message, then repair or replace the user-selected asset record without changing provider or content policy implicitly.",
    recheck: "Inspect the adopted bytes again and compile the same scope.",
  },
  blocking: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "Authored blocking must lower to valid deterministic stage relations for the registered shot contract.",
    correction:
      "Correct the blocking operation named by the occurrence without replacing the author's staging decision.",
    recheck: "Execute the shot source and compile the affected shot again.",
  },
  builder: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "A shot builder must execute successfully inside the deterministic source boundary.",
    correction:
      "Repair the exact authored builder failure reported by the occurrence without bypassing the compiler boundary.",
    recheck: "Execute the same source registration and compile scope again.",
  },
  capture: {
    guide: "CAPTURE_FRAME",
    path: "prompts/CAPTURE_FRAME.md#captureframe-contract",
    invariant:
      "A review capture must reopen as current host-produced pixels bound to the exact production, target, renderer, and compile fingerprint.",
    correction:
      "Follow the occurrence message to restore the named host, registration, input, or receipt; never treat a refused capture as evidence.",
    recheck:
      "Retry the same capture request after recompiling any changed source.",
  },
  compile: {
    guide: "COMPILATION",
    path: "prompts/COMPILATION.md#compilation",
    invariant:
      "Compilation consumes one current, stable input closure and publishes derived state only after the requested scope succeeds.",
    correction:
      "Use the occurrence message to correct the identified input or rerun after the concurrent change; no catalog lookup edits the project.",
    recheck: "Run the same compile scope against one unchanged input revision.",
  },
  content: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "Compiler input must remain inside the declared deterministic and security boundary.",
    correction:
      "Remove or replace the exact unsafe input named by the occurrence under the production author's policy.",
    recheck: "Run the same source or compile validation again.",
  },
  contract: {
    guide: "SHOT_CONTRACT",
    path: "prompts/SHOT_CONTRACT.md#shot-contract",
    invariant:
      "The registered shot and its realized source must agree with one exact authored contract.",
    correction:
      "Correct the contract or source relation named by the occurrence; the compiler does not rewrite either side to make them agree.",
    recheck:
      "Compile the affected shot and re-evaluate all contract realizations.",
  },
  design: {
    guide: "COMPILATION",
    path: "prompts/COMPILATION.md#compilation",
    invariant:
      "Tracked design must be complete, internally consistent, addressable, and supported before downstream compilation can consume it.",
    correction:
      "Correct the exact design owner, field, or reference named by the occurrence; do not invent content, providers, or fallback values.",
    recheck:
      "Validate design scope first, then repeat every invalidated downstream scope.",
  },
  engine: {
    guide: "DEBUGGING",
    path: "prompts/DEBUGGING.md#debugging-handbook",
    invariant:
      "Engine validation must succeed before its output can be accepted as compiled production state.",
    correction:
      "Inspect the nested engine failure in the occurrence and repair the authored geometry, motion, timing, or bounded state it names.",
    recheck: "Run engine validation and then the same compile scope.",
  },
  environment: {
    guide: "WORLD_BUILDING",
    path: "prompts/WORLD_BUILDING.md#world-building-handbook",
    invariant:
      "Environment context must name valid authored spatial owners and may not derive physical facts from labels or appearance.",
    correction:
      "Correct the explicit world, building, space, or material fact named by the occurrence; do not infer a missing physical parameter.",
    recheck:
      "Validate the environment and repeat the consuming compile operation.",
  },
  film: {
    guide: "EDITING",
    path: "prompts/EDITING.md#editing-handbook",
    invariant:
      "The compiled film must account for every selected shot, transition, cue, clock join, and deliverable interval on one exact timeline.",
    correction:
      "Correct the user-authored film or shot timing relation identified by the occurrence without silently selecting an edit.",
    recheck: "Compile the film again and revalidate its complete timeline.",
  },
  generated: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "Compiler-owned generated output must exactly match the current source closure and its manifest.",
    correction:
      "Repair tracked source or remove only the specifically diagnosed stale generated artifact through the documented compiler workflow.",
    recheck: "Run the owning compile or read-only lint operation again.",
  },
  geometry: {
    guide: "GEOMETRY",
    path: "prompts/GEOMETRY.md#geometry",
    invariant:
      "Geometry queries must use supported selectors that resolve inside the current compiled production.",
    correction:
      "Correct the selector or its tracked owner named by the occurrence; do not substitute a guessed measurement.",
    recheck: "Repeat the same geometry query against current compiled state.",
  },
  grammar: {
    guide: "SCREENPLAY_WRITING",
    path: "prompts/SCREENPLAY_WRITING.md#screenplay-writing-handbook",
    invariant:
      "Authored style intent must account for deliberate film-grammar departures observed in the compiled result.",
    correction:
      "Re-author the shot or its explicit style intent; the diagnostic does not choose the creative resolution.",
    recheck: "Compile and review the affected shot and film relation again.",
  },
  legacy: {
    guide: "COMPILATION",
    path: "prompts/COMPILATION.md#compilation",
    invariant:
      "Legacy import must preserve source, disclose every default or reconstruction, and refuse facts that cannot be recovered.",
    correction:
      "Resolve the named reconstruction decision in tracked user-owned design or supply the missing legacy source.",
    recheck:
      "Repeat import, reopen the project, and compile the affected scopes.",
  },
  model: {
    guide: "ASSET_SOURCING",
    path: "prompts/ASSET_SOURCING.md#asset-sourcing-handbook",
    invariant:
      "A model recipe must use a registered archetype and supported, bounded parameter contract.",
    correction:
      "Correct the named recipe or explicitly choose another registered archetype; the catalog never selects one.",
    recheck: "Validate design and materialize the model again.",
  },
  performance: {
    guide: "MOTION",
    path: "prompts/MOTION.md#motion-handbook",
    invariant:
      "Authored performance must lower to supported deterministic pose, motion, expression, and timing state.",
    correction:
      "Correct the named performance input while leaving creative motion and external-take selection with the author.",
    recheck: "Execute the performance and compile the affected shot again.",
  },
  pipeline: {
    guide: "DEBUGGING",
    path: "prompts/DEBUGGING.md#debugging-handbook",
    invariant:
      "The deterministic source-to-film pipeline must complete before its result can be accepted.",
    correction:
      "Inspect the nested pipeline failure and repair its owning tracked source or design input.",
    recheck: "Run the same pipeline and compile scope again.",
  },
  preview: {
    guide: "CAPTURE_FRAME",
    path: "prompts/CAPTURE_FRAME.md#captureframe-contract",
    invariant:
      "Preview may render only a valid, current, registered target under the host capture contract.",
    correction:
      "Correct or compile the target named by the occurrence before asking the host to capture it.",
    recheck: "Repeat the same preview or capture request.",
  },
  production: {
    guide: "COMPILATION",
    path: "prompts/COMPILATION.md#compilation",
    invariant:
      "Every operation must remain bound to one registered production namespace and its current addressable state.",
    correction:
      "Use the occurrence target and message to select or register the intended production explicitly.",
    recheck: "Reopen the named production and retry the same operation.",
  },
  registration: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "Source registration must bind the declared production, shot, and export identities exactly once.",
    correction:
      "Correct the explicit registration named by the occurrence without guessing an alternate production or shot.",
    recheck: "Load the source and compile its registered target again.",
  },
  render: {
    guide: "COMPILATION",
    path: "prompts/COMPILATION.md#compilation",
    invariant:
      "Rendered delivery must be complete, current, byte-verified, media-verified, and owned by its exact production input.",
    correction:
      "Repair or regenerate the exact rendition or receipt named by the occurrence; never accept a path or label as proof.",
    recheck: "Render again if required, then run the same final verification.",
  },
  repaint: {
    guide: "REPAINT_SHOT",
    path: "prompts/REPAINT_SHOT.md#repaintshot-contract",
    invariant:
      "Optional repaint may consume only current reviewed source pixels, declared controls, references, provider facts, and immutable receipts.",
    correction:
      "Resolve the exact eligibility, host, evidence, or receipt failure named by the occurrence without choosing a provider or candidate automatically.",
    recheck:
      "Repeat the same repaint request after its declared prerequisites are current.",
  },
  review: {
    guide: "AUTOMOVIE_OVERALL",
    path: "prompts/AUTOMOVIE_OVERALL.md#guide-selection",
    invariant:
      "Review completion requires fresh target-local evidence, every required criterion, an observation, correction state, and a non-copied outcome.",
    correction:
      "Inspect the returned evidence and repair the worksheet field named by the occurrence; the service never decides the verdict for the reviewer.",
    recheck:
      "Prepare a fresh worksheet and submit every returned criterion again.",
  },
  screenplay: {
    guide: "SCREENPLAY_WRITING",
    path: "prompts/SCREENPLAY_WRITING.md#screenplay-writing-handbook",
    invariant:
      "The screenplay ladder must preserve unique identities, ordered coverage, evidence ownership, locks, and explicit omissions from intent to scene.",
    correction:
      "Correct the named screenplay document or relation while preserving author ownership of story content.",
    recheck:
      "Run screenplay lint and compile every affected scene relation again.",
  },
  source: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
    invariant:
      "Tracked source must export the registered deterministic contract and stay inside the compiler sandbox and ownership boundary.",
    correction:
      "Correct the exact module, export, capability, or registration named by the occurrence without bypassing the sandbox.",
    recheck: "Run source lint and the same compile scope again.",
  },
  stage: {
    guide: "SOURCE_OWNERSHIP",
    path: "prompts/SOURCE_OWNERSHIP.md#source-ownership",
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
  "review-outcome-artifact-malformed": {
    guide: "REVIEW_SHOT",
    path: "prompts/REVIEW_SHOT.md#shot-review-contract",
    invariant:
      "A current compiler-owned acceptance artifact must remain readable, digest-matched UTF-8 JSON before review can derive an outcome from it.",
    correction:
      "Remove only the damaged compiler-owned publication named by the occurrence, then compile the same current inputs again; do not edit an acceptance outcome by hand.",
    recheck:
      "Prepare the same review again and confirm the named artifact reads under its current manifest digest.",
  },
  "review-outcome-artifact-missing": {
    guide: "REVIEW_SHOT",
    path: "prompts/REVIEW_SHOT.md#shot-review-contract",
    invariant:
      "Every manifest-owned acceptance artifact required by a current compile must be resident before review derives an outcome.",
    correction:
      "Compile the same current inputs to restore the missing compiler-owned publication named by the occurrence.",
    recheck:
      "Prepare the same review again and confirm the named artifact is resident under the current generated manifest.",
  },
  "review-outcome-contract-mismatch": {
    guide: "REVIEW_SHOT",
    path: "prompts/REVIEW_SHOT.md#shot-review-contract",
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
    guide: contract.guide,
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
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Makes every shipped code and exactly one reference enumerable.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Delivers the same-revision complete catalog without adding an MCP tool.
 */
export const listAutoMovieDiagnosticCatalog =
  (): readonly Readonly<IAutoMovieDiagnosticCatalogEntry>[] =>
    DIAGNOSTIC_CATALOG;

/**
 * Resolve one diagnostic code without changing project or catalog state.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Requires code lookup on the user-facing knowledge surface.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Returns one versioned behavioral reference or null for an unknown code.
 */
export const findAutoMovieDiagnosticCatalogEntry = (
  code: string,
): Readonly<IAutoMovieDiagnosticCatalogEntry> | null =>
  DIAGNOSTIC_CATALOG_BY_CODE.get(code as AutoMovieDiagnosticCode) ?? null;
