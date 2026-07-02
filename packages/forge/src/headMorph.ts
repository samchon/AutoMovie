/** One sparse vertex delta of a morph: `[localIndex, dx, dy, dz]`. */
export type ForgeHeadDelta = [number, number, number, number];

/**
 * A bipolar parameter morph on the parametric head: the sculpt for the `+1`
 * direction and the (independent) sculpt for the `-1` direction.
 *
 * The two are NOT negatives of each other — "wider nose" and "narrower nose"
 * are separately authored shapes, so each direction carries its own deltas.
 *
 * @author Samchon
 */
export interface IForgeHeadMorph {
  /** Sparse vertex deltas applied when the parameter value is positive. */
  plus: ForgeHeadDelta[];

  /** Sparse vertex deltas applied when the parameter value is negative. */
  minus: ForgeHeadDelta[];
}

/**
 * Apply bipolar parameter morphs to a base position array.
 *
 * For each named parameter with a non-zero value, the matching direction
 * (`plus` for `v > 0`, `minus` for `v < 0`) is weighted by `|v|` and added onto
 * the base. Unknown names and zero values are skipped. The base is not mutated;
 * a new flat `xyz` array is returned.
 *
 * This is the pure deformation primitive behind the parametric head editor —
 * the same additive model MakeHuman's `.target` system uses, kept independent
 * of any geometry source so it can be unit-tested in isolation.
 *
 * @author Samchon
 */
export const morphHead = (
  base: number[],
  morphs: Record<string, IForgeHeadMorph>,
  values: Record<string, number>,
): number[] => {
  const out = base.slice();
  for (const [name, v] of Object.entries(values)) {
    if (!v) continue;
    const morph = morphs[name];
    if (morph === undefined) continue;
    const side = v > 0 ? morph.plus : morph.minus;
    const w = Math.abs(v);
    for (const [li, dx, dy, dz] of side) {
      out[li * 3] = out[li * 3]! + dx * w;
      out[li * 3 + 1] = out[li * 3 + 1]! + dy * w;
      out[li * 3 + 2] = out[li * 3 + 2]! + dz * w;
    }
  }
  return out;
};
