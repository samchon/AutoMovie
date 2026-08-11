import {
  IAutoMovieSubmitReviewInput,
  IAutoMovieSubmitReviewOutput,
} from "../IAutoMovieProductionReview";

/**
 * Result of validating and storing one evidence-first review.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieSubmitReview` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieSubmitReview` for the review system execution status system contract.
 */
export interface IAutoMovieSubmitReview extends IAutoMovieSubmitReviewOutput {}

export namespace IAutoMovieSubmitReview {
  /**
   * One complete evidence-first review worksheet.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IProps` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IProps` for the review system execution status system contract.
   */
  export interface IProps extends IAutoMovieSubmitReviewInput {}
}
