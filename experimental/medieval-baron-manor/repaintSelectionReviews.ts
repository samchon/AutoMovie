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
 * Current reviewed continuity basis for aggregate film playback.
 *
 * Keep this separate from the observation below: changing the baseline,
 * applicable scope, or intended deltas must stale the observation that was
 * recorded against its predecessor. Leave null for an all-deterministic film.
 */
export const repaintSequenceBaseline:
  | IAutoMovieRepaintSequenceObservation["baseline"]
  | null = null;

/**
 * Latest aggregate playback observation of the exact current film member set.
 * Failed, unsupported, and not-run observations remain recordable here; only
 * a current completed five-pass observation can authorize final publication.
 */
export const repaintSequenceObservation: IAutoMovieRepaintSequenceObservation | null =
  null;
