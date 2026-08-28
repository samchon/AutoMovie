import type { IAutoMovieProductionRepaintSelectionReview } from "./scripts/productionConfiguration";

/**
 * Post-generation observations keyed by authored shot id.
 *
 * A repaint request keeps its `selectionReview` null until candidate bytes
 * exist. Add the reviewed candidate here, then resolve that shot's entry from
 * `automovie.config.ts`. This control-plane file is typechecked but deliberately
 * excluded from deterministic compiler content: reviewing derived appearance
 * must not invalidate the source render and candidate being reviewed.
 */
export const repaintSelectionReviews: Readonly<
  Record<string, IAutoMovieProductionRepaintSelectionReview>
> = {};
