import {
  IAutoMovieSubmitReviewInput,
  IAutoMovieSubmitReviewOutput,
} from "../IAutoMovieProductionReview";

/** Result of validating and storing one evidence-first review. */
export interface IAutoMovieSubmitReview extends IAutoMovieSubmitReviewOutput {}

export namespace IAutoMovieSubmitReview {
  /** One complete evidence-first review worksheet. */
  export interface IProps extends IAutoMovieSubmitReviewInput {}
}
