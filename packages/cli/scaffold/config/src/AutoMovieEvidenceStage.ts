/**
 * How far one production evidence layer has progressed.
 *
 * A layer moves from `disabled` to `evidence` and then to `review`. The final
 * state keeps current review fingerprints mandatory after later edits.
 */
export type AutoMovieEvidenceStage = "disabled" | "evidence" | "review";
