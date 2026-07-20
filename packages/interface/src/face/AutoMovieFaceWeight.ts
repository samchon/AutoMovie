/**
 * A signed face-shape morph weight: the leaf value type of every
 * {@link IAutoMovieFace} trait.
 *
 * The value is a plain `number` in `[-2, 2]`: `0` is the neutral template (the
 * balanced average face), `±1` is one nameable trait step away from it, and
 * `±2` is the believable-human edge, beyond which reads as caricature. Per the
 * interface package's rough-types rule the range is documented here and
 * enforced at runtime by the engine's `validateFace` (Tier-1), not encoded as
 * `typia` tag constraints: face types reach no `typia.llm.*` schema surface, so
 * tags would have no structured-output effect and would only duplicate the
 * validator that already owns the range.
 *
 * @author Samchon
 */
export type AutoMovieFaceWeight = number;
