import {
  IAutoMoviePrepareReviewInput,
  IAutoMoviePrepareReviewOutput,
} from "../IAutoMovieProductionReview";

/**
 * Current worksheet and evidence inventory for one review target.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMoviePrepareReview` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMoviePrepareReview` for the review system execution status system contract.
 */
export interface IAutoMoviePrepareReview extends IAutoMoviePrepareReviewOutput {}

export namespace IAutoMoviePrepareReview {
  /**
   * Select one current review target.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IProps` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IProps` for the review system execution status system contract.
   */
  export interface IProps extends IAutoMoviePrepareReviewInput {}
}
