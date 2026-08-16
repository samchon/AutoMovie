import type {
  IAutoMoviePrepareReview,
  IAutoMovieSubmitReview,
} from "@automovie/interface";

import type { AutoMovieProductionContext } from "./AutoMovieProductionContext";
import { autoMovieReviewGuide, requireAutoMovieGuides } from "./guideGate";

/**
 * Prepare the current worksheet for one review target.
 *
 * The knowledge gate is target-specific. What a shot review must answer is not
 * what an asset or a film review must answer.
 *
 * The ledger stores the verdict of a reviewer who read the wrong contract as
 * faithfully as any other, so the right contract is demanded before the
 * worksheet is handed out.
 */
export const prepareAutoMovieReviewWorksheet = (
  context: AutoMovieProductionContext,
  props: IAutoMoviePrepareReview.IProps,
): IAutoMoviePrepareReview => {
  requireAutoMovieGuides(
    context,
    "prepareReview",
    autoMovieReviewGuide(props.target),
  );
  return context.forProduction().review.prepare(props);
};

/**
 * Store one submitted worksheet against its freshly prepared fingerprint.
 *
 * It is gated on the same target contract the worksheet was prepared under,
 * because the submission is judged against the axes that contract defines.
 */
export const submitAutoMovieReviewWorksheet = (
  context: AutoMovieProductionContext,
  props: IAutoMovieSubmitReview.IProps,
): IAutoMovieSubmitReview => {
  requireAutoMovieGuides(
    context,
    "submitReview",
    autoMovieReviewGuide(props.target),
  );
  return context.forProduction().review.submit(props);
};
