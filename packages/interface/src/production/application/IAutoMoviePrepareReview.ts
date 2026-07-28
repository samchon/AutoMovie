import {
  IAutoMoviePrepareReviewInput,
  IAutoMoviePrepareReviewOutput,
} from "../IAutoMovieProductionReview";

/** Current worksheet and evidence inventory for one review target. */
export interface IAutoMoviePrepareReview extends IAutoMoviePrepareReviewOutput {}

export namespace IAutoMoviePrepareReview {
  /** Select one current review target. */
  export interface IProps extends IAutoMoviePrepareReviewInput {}
}
