/**
 * One scalar component of glTF cubic Hermite interpolation.
 *
 * `outTangent` belongs to the left key and `inTangent` to the right; both are
 * derivatives per second, so the segment `span` scales them before the Hermite
 * basis is applied. The sampler and every range proof share this evaluator: a
 * validator proving a different polynomial than playback uses is no proof.
 */
export const cubicHermiteValue = (
  left: number,
  outTangent: number,
  right: number,
  inTangent: number,
  span: number,
  t: number,
): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * left +
    (t3 - 2 * t2 + t) * span * outTangent +
    (-2 * t3 + 3 * t2) * right +
    (t3 - t2) * span * inTangent
  );
};
