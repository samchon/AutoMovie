import {
  AutoMovieSubjectKind,
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectMemberSummary,
} from "./IAutoMovieSubjectDescription";

/**
 * Aggregate consequence of one structural subject change.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Reports prototype consequences without emitting one record per use.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Types bounded element, set, instance, and prototype-selection fan-out.
 */
export interface IAutoMovieSubjectDiffFanout {
  /**
   * Number of scene elements whose geometry references the changed prototype.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Quantifies prototype use by placed elements without duplicate change entries.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the aggregate referencing-element count.
   */
  elements: number;
  /**
   * Number of compact instance slots whose geometry references the prototype.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Quantifies repeated prototype use without member-sized output.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the aggregate referencing-instance count.
   */
  instances: number;
  /**
   * Bounded identities of compact sets represented by {@link instances}.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Keeps affected instance sets addressable while bounding output.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the deterministic set-id summary.
   */
  instanceSets: IAutoMovieSubjectMemberSummary;
  /**
   * Number of slots whose selected prototype differs between set revisions.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Summarizes instance prototype changes without per-slot diff records.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Counts changed common selections plus added or removed slots.
   */
  prototypeChanges: number;
}

/**
 * One subject entry in a structural diff category.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Gives added, removed, moved, and reshaped categories stable subject records.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the before/after pair and aggregate consequence of one change.
 */
export interface IAutoMovieSubjectChange {
  /**
   * Stable subject id shared with the non-null description.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Identifies the changed compiled subject.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Uses stable id as the comparison key.
   */
  id: string;
  /**
   * Structural kind of the changed subject.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Keeps each change interpretable by subject role.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Carries the common role discriminator.
   */
  kind: AutoMovieSubjectKind;
  /**
   * Subject before the change, or null for an addition.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Makes the prior compiled state inspectable.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the nullable prior state.
   */
  before: IAutoMovieSubjectDescription | null;
  /**
   * Subject after the change, or null for a removal.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Makes the next compiled state inspectable.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the nullable next state.
   */
  after: IAutoMovieSubjectDescription | null;
  /**
   * Aggregate placements and selections affected by this record.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Prevents prototype changes from expanding into per-use records.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the bounded consequence summary.
   */
  fanout: IAutoMovieSubjectDiffFanout;
}

/**
 * Structural comparison of two compiled subject inventories.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Exposes render-free added, removed, moved, reshaped, and unchanged results.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Defines the portable categorized diff contract.
 */
export interface IAutoMovieSubjectDiff {
  /**
   * Structural-diff schema version.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Makes the portable diff version explicit.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the first diff schema.
   */
  version: 1;
  /**
   * Revision of the earlier compiled artifact.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Identifies the baseline used by the comparison.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Carries the prior artifact revision.
   */
  fromRevision: string;
  /**
   * Revision of the later compiled artifact.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Identifies the candidate used by the comparison.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Carries the next artifact revision.
   */
  toRevision: string;
  /**
   * Inclusive absolute numeric tolerance used by this comparison.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Makes numeric comparison policy visible to the reviewer.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Carries the finite non-negative comparison threshold.
   */
  tolerance: number;
  /**
   * Subjects present only in the later revision.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Reports compiled additions as a distinct category.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types exclusive added records.
   */
  added: IAutoMovieSubjectChange[];
  /**
   * Subjects present only in the earlier revision.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Reports compiled removals as a distinct category.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types exclusive removed records.
   */
  removed: IAutoMovieSubjectChange[];
  /**
   * Common subjects whose placement state changed.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Reports transform, owner, space, or prototype placement changes.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the non-exclusive moved category.
   */
  moved: IAutoMovieSubjectChange[];
  /**
   * Common subjects whose reusable structure or population law changed.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Reports geometry and compact-population changes.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Types the non-exclusive reshaped category.
   */
  reshaped: IAutoMovieSubjectChange[];
  /**
   * Bounded summary of common subjects in neither changed category.
   *
   * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Makes a no-change result explicit and reviewable.
   * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Carries deterministic bounded unchanged identity.
   */
  unchanged: IAutoMovieSubjectMemberSummary;
}
