import type { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * Encoding used to carry exact derived bytes through the JSON source context.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact Makes precomputed project bytes available without turning them into source literals.
 * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Preserves text directly and binary through one explicit base64 representation.
 * @author Samchon
 */
export type AutoMovieDerivedArtifactEncoding = "utf8" | "base64";

/**
 * One exact file consumed by a deterministic precomputation.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Makes every declared input byte part of the product-owned basis.
 * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Types one canonical member of the ordered digest closure.
 * @author Samchon
 */
export interface IAutoMovieDerivedArtifactDependency {
  /**
   * Canonical project-relative input path.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Identifies which declared project input the generator consumed.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Supplies the stable role of one input digest.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability Restricts dependency identity to one canonical project-relative spelling across hosts.
   */
  path: string;
  /**
   * SHA-256 of the exact input bytes.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Makes a changed input stale without a manually bumped revision.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Seals one exact input payload into the basis closure.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Tracked identity of one explicitly generated deterministic artifact.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact Replaces giant source literals with reviewable project-owned derived bytes.
 * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Carries the separate manifest record the compiler verifies.
 * @author Samchon
 */
export interface IAutoMovieDerivedArtifactRecord {
  /**
   * Canonical output path below `automovie/derived/`.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation Gives deterministic derivation a namespace external assets cannot own.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Locates the exact resident output independently from the external asset ledger.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability Carries the canonical project-relative output identity the physical publication gate enforces.
   */
  path: string;
  /**
   * Source-context representation of the exact output bytes.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact Lets source consume text or binary results without embedding them in TypeScript.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Declares how verified bytes cross the JSON sandbox boundary.
   */
  encoding: AutoMovieDerivedArtifactEncoding;
  /**
   * Generator source identity and normalized-source digest.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Makes the generator itself an input rather than a remembered revision number.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Seals normalized generator source into the basis.
   */
  generator: IAutoMovieDerivedArtifactDependency;
  /**
   * Declared input files sorted by canonical path.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Exposes the complete declared input set for review and freshness checks.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Keeps input ordering portable and rejects duplicate identities.
   */
  inputs: IAutoMovieDerivedArtifactDependency[];
  /**
   * Domain-separated digest of generator and declared input identities.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Gives compile one product-owned live-versus-recorded basis comparison.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Identifies the complete versioned dependency closure.
   */
  basisDigest: AutoMovieContentDigest;
  /**
   * SHA-256 of the exact artifact bytes.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Detects edited, partial, or stale output before source can consume it.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Pins the resident output independently from its basis.
   */
  outputDigest: AutoMovieContentDigest;
}

/**
 * Project-owned ledger for deterministic precomputation results.
 *
 * This is not external asset provenance. It records reproducible derivation
 * from tracked source and declared project inputs and carries no acquisition,
 * provider, license, or consumer fields.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation Keeps deterministic project derivation out of the external asset manifest.
 * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Defines the separate versioned ledger and canonical artifact order.
 * @author Samchon
 */
export interface IAutoMovieDerivedArtifactManifest {
  /**
   * Derived-artifact manifest format.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Makes incompatible or malformed ledger semantics explicitly rejectable.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Selects the version-one manifest contract.
   */
  version: 1;
  /**
   * Artifact records sorted by canonical output path.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication Keeps the same artifact ordering across Windows and POSIX.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Provides one portable record per owned output.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-generation Represents only completed artifact records in the manifest published after their output bytes.
   */
  artifacts: IAutoMovieDerivedArtifactRecord[];
}

/**
 * One current derived artifact projected into deterministic source context.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Exposes only bytes whose live basis and output digest passed compile-time verification.
 * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Defines the exact JSON-safe source-context projection.
 * @author Samchon
 */
export interface IAutoMovieDerivedArtifactSource {
  /**
   * Current output digest verified before context publication.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Lets source and downstream diagnostics retain the verified byte identity.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Carries the checked output identity with its content.
   */
  digest: AutoMovieContentDigest;
  /**
   * Whether content is direct UTF-8 text or base64 of raw bytes.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact Gives ordinary source a stable interpretation without a giant literal.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Preserves arbitrary exact bytes across the sandbox JSON boundary.
   */
  encoding: AutoMovieDerivedArtifactEncoding;
  /**
   * Verified text or base64 payload.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact Supplies the precomputed result to authored source.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Publishes content only after every freshness gate succeeds.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-budget-boundary Leaves artifact payload length unconstrained while a later measured policy may bound transfer separately.
   */
  content: string;
}
