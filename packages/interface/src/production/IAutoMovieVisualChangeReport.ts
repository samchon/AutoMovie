import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * One stable rendered observation in a named revision snapshot.
 *
 * The record deliberately carries only the identity needed to join the same
 * view across revisions and the digest a producer already verified. It is not
 * review evidence and does not prescribe how a camera or subject is produced.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Exposes a stable subject-view identity inside one named visual catalog.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse Carries the existing image digest without requiring another byte read or hash.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Types one unique subject-view record in a revision snapshot.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-digest-boundary Keeps the comparison input independent of render, decode, and filesystem operations.
 *
 * @author Samchon
 */
export interface IAutoMovieVisualRevisionView {
  /**
   * Stable namespaced subject identity, such as a shot or compiled subject id.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Identifies what the observation depicts without defining a subject hierarchy.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Forms the first half of the unique catalog key.
   */
  subject: string;
  /**
   * Stable catalog-local view identity. A different viewpoint, time, pass, or
   * presentation basis requires a different identity.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Identifies which repeatable observation of the subject is being compared.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Forms the second half of the unique catalog key.
   */
  view: string;
  /**
   * Exact digest of the already-produced image bytes.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse Reuses the producer's byte identity instead of requesting the bytes again.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-digest-boundary Supplies the sole value compared by the pure fold.
   */
  digest: AutoMovieContentDigest;
}

/**
 * One named visual catalog at one production revision.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Binds a unique visual population to its revision and catalog identity.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse Makes validation possible before any comparison result is returned.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Defines the complete input snapshot of the comparison.
 *
 * @author Samchon
 */
export interface IAutoMovieVisualRevisionSnapshot {
  /**
   * Non-blank production or compile revision identity.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Names the exact revision whose observations are listed.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Types the revision identity copied into the report.
   */
  revision: string;
  /**
   * Non-blank identity of the observation population.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Prevents unrelated delivery and inspection view sets from being compared as one.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Types the equality precondition between snapshots.
   */
  catalog: string;
  /**
   * Unique subject-view records in arbitrary input order.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse Supplies validated existing digests without exposing image bytes.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Carries the population whose ordering is non-semantic.
   */
  views: IAutoMovieVisualRevisionView[];
}

/**
 * Exhaustive status of one subject-view identity across two revisions.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Keeps unchanged observations visible beside changed, new, and gone observations.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Types the four mutually exclusive outcomes of the identity join.
 */
export type AutoMovieVisualChangeStatus =
  | "changed"
  | "unchanged"
  | "new"
  | "gone";

/**
 * One deterministic subject-view comparison result.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Preserves every common and one-sided observation with one explicit state.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-evidence-boundary Carries digest equality only and no quality or review conclusion.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Types the sorted joined record and its nullable sides.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-evidence-separation Keeps progress facts structurally separate from review evidence and subject geometry.
 *
 * @author Samchon
 */
export interface IAutoMovieVisualChange {
  /**
   * Stable subject identity shared with the snapshot records.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Identifies the subject whose view received this status.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Preserves the first sorted key component.
   */
  subject: string;
  /**
   * Stable view identity shared with the snapshot records.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Identifies the repeatable view whose bytes were compared.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Preserves the second sorted key component.
   */
  view: string;
  /**
   * Exactly one of the four visual change states.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Exposes changed, unchanged, new, or gone without dropping unchanged entries.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Types the exhaustive join outcome.
   */
  status: AutoMovieVisualChangeStatus;
  /**
   * Earlier digest, or null when this view is new.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Preserves the earlier side needed to inspect the classification.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Makes absence explicit for a later-only identity.
   */
  before: AutoMovieContentDigest | null;
  /**
   * Later digest, or null when this view is gone.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Preserves the later side needed to inspect the classification.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Makes absence explicit for an earlier-only identity.
   */
  after: AutoMovieContentDigest | null;
}

/**
 * Exact cardinalities of the complete four-state comparison.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Reports exact totals without omitting unchanged observations.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Types the four counts whose sum equals the returned view population.
 *
 * @author Samchon
 */
export interface IAutoMovieVisualChangeCounts {
  /**
   * Common identities whose image digests differ.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Counts changed observations.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Counts the unequal-digest common branch.
   */
  changed: number;
  /**
   * Common identities whose image digests are equal.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Counts unchanged observations as first-class facts.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Counts the equal-digest common branch.
   */
  unchanged: number;
  /**
   * Identities found only in the later snapshot.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Counts new observations.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Counts the later-only branch.
   */
  new: number;
  /**
   * Identities found only in the earlier snapshot.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Counts gone observations.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Counts the earlier-only branch.
   */
  gone: number;
}

/**
 * Deterministic visual progress report between two revision snapshots.
 *
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Exposes every classified view and exact state totals.
 * @evidence requirements/review/visual-change-reporting.md#review-visual-change-evidence-boundary Represents progress without carrying a verdict, criterion, receipt, or structural change.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Defines the versioned output of the deterministic join.
 * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-evidence-separation Keeps the output outside the delivery-evidence and compiled-structure contracts.
 *
 * @author Samchon
 */
export interface IAutoMovieVisualChangeReport {
  /**
   * Report schema version.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Makes the portable comparison format explicit.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Types the first report schema.
   */
  version: 1;
  /**
   * Shared catalog identity.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Shows which observation population was compared.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Preserves the validated same-catalog precondition.
   */
  catalog: string;
  /**
   * Earlier revision identity.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Binds the before side to its named revision.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Copies the earlier snapshot identity.
   */
  fromRevision: string;
  /**
   * Later revision identity.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity Binds the after side to its named revision.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-revision-snapshot Copies the later snapshot identity.
   */
  toRevision: string;
  /**
   * Exact totals for the four states.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Makes unchanged work visible in the summary beside every other state.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Carries totals derived from the complete returned population.
   */
  counts: IAutoMovieVisualChangeCounts;
  /**
   * Complete code-unit-sorted visual comparison.
   *
   * @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states Preserves every identity from either revision with one status.
   * @evidence specifications/review-and-acceptance/visual-change-reporting.md#review-system-visual-change-states Carries the deterministic union join.
   */
  views: IAutoMovieVisualChange[];
}
