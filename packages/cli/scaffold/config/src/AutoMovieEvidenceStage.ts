/**
 * How far one production evidence layer has progressed.
 *
 * `disabled` means the layer has no governed hosts: its production kind either
 * forbids it or its authorship has not begun. An applicable layer moves from
 * `draft` to `evidence` and then to `review`; the final state keeps current
 * review fingerprints mandatory after later edits.
 */
export type AutoMovieEvidenceStage =
  | "disabled"
  | "draft"
  | "evidence"
  | "review";
