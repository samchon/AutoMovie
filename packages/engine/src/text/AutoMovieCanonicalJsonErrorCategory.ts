/**
 * Stable reasons a value cannot enter canonical JSON identity.
 *
 * Each member names one violated domain rule of `automovie.canonical-json.v2`
 * rather than a host engine's error wording, so a Node capture path and a
 * browser viewer classify the same refused value identically.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-digest-refusal Names the canonicalization failure and unsupported numeric value classes that must be refused instead of digested.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Separates the representation rules a refused identity input broke so the frame is rejected by a stable reason.
 */
export type AutoMovieCanonicalJsonErrorCategory =
  | "unsupported-value"
  | "invalid-unicode"
  | "cyclic-value"
  | "non-plain-container"
  | "accessor-property";
