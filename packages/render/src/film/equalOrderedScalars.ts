import type { AutoMovieOrderedScalar } from "./AutoMovieOrderedScalar";

/**
 * Compare ordered arrays of scalars, or of arrays of scalars, by value.
 *
 * The domain is exactly what the planned audio identity compares: a fixed
 * speaker-label array such as `["front-left", "front-right"]`, and a one-row
 * downmix matrix such as `[[0.5, 0.5]]`. Both are ordered, both hold only
 * numbers or strings, and both nest at most one level. Inside that domain the
 * comparison is total: a different length, a different order, a different type
 * at the same position, or a nested row differing in any of those ways is
 * unequal. `Object.is` decides each scalar, so `NaN` equals `NaN` and `+0`
 * differs from `-0`, which is what `node:util`'s `isDeepStrictEqual` did for
 * these values.
 *
 * Records are deliberately outside the domain rather than silently accepted. A
 * non-array argument is refused instead of compared, so an object cannot pass by
 * having no `length`; and nothing here compares prototypes, symbol keys, boxed
 * primitives or cycles, because no caller needs that and a general deep equality
 * invites one whose answer turns on key order.
 */
export const equalOrderedScalars = (
  left: readonly (AutoMovieOrderedScalar | readonly AutoMovieOrderedScalar[])[],
  right: readonly (
    | AutoMovieOrderedScalar
    | readonly AutoMovieOrderedScalar[]
  )[],
): boolean => {
  if (Array.isArray(left) === false || Array.isArray(right) === false)
    return false;
  if (left.length !== right.length) return false;
  for (let at = 0; at < left.length; ++at) {
    const one = left[at];
    const other = right[at];
    if (Array.isArray(one) || Array.isArray(other)) {
      if (Array.isArray(one) === false || Array.isArray(other) === false)
        return false;
      if (one.length !== other.length) return false;
      for (let inner = 0; inner < one.length; ++inner)
        if (Object.is(one[inner], other[inner]) === false) return false;
      continue;
    }
    if (Object.is(one, other) === false) return false;
  }
  return true;
};
