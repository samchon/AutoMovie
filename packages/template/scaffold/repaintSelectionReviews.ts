import type { IAutoMovieRepaintSequenceObservation } from "@automovie/interface";

import type { IAutoMovieProductionRepaintSelectionReview } from "./scripts/productionConfiguration";

/**
 * Post-generation observations keyed by authored shot id.
 *
 * A repaint request resolves its selection review to null until candidate bytes
 * exist. Add the reviewed candidate here under its authored shot id, and the
 * repaint runtime joins it to that shot's request on the production design
 * record. This control-plane file is typechecked but deliberately excluded from
 * deterministic compiler content: reviewing derived appearance must not
 * invalidate the source render and candidate being reviewed.
 */
export const repaintSelectionReviews: Readonly<
  Record<string, IAutoMovieProductionRepaintSelectionReview>
> = {};

/**
 * Latest aggregate playback observation of the exact current film member set.
 * Failed, unsupported, and not-run observations remain recordable here; only
 * a current completed five-pass observation can authorize final publication.
 */
export const repaintSequenceObservation: IAutoMovieRepaintSequenceObservation | null =
  null;
