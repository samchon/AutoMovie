/**
 * One transverse control curve of a lower-nasal depth loft. The section height
 * and every control depth use millimetres relative to the socket's datum.
 * Cubic control poles describe a curve; they are not measured surface samples.
 *
 * @author Samchon
 */
export interface IPortraitNasalSectionStation {
  /** Head-Y height relative to the common datum, increasing between stations. */
  height: number;
  /** Head-Z depths at the profile's ordered transverse control poles. */
  depths: readonly number[];
}

/**
 * A connected lower-nasal shape in a translated head frame: +X anatomical left,
 * +Y up and +Z anterior. Transverse poles and station heights use millimetres;
 * depths are absolute positions relative to the same socket datum, not added
 * Gaussian projections. Left and right poles may carry different depths.
 *
 * The clamped tensor-product cubic B-spline is C2 inside its domain. Its
 * nonnegative partition-of-unity weights keep the loft inside its control
 * depth hull. Control counts are bounded at 64 per axis so fitting one source
 * point never evaluates more than 4096 authored scalar controls.
 *
 * @author Samchon
 */
export interface IPortraitNasalSection {
  /** Four through 64 strictly increasing local-X control positions, in mm. */
  transverse: readonly number[];
  /** Four through 64 strictly increasing local-Y transverse control curves. */
  stations: readonly IPortraitNasalSectionStation[];
  /**
   * Positive width of the identity transition at each rectangular domain edge,
   * in mm, no greater than half either domain span. A quintic blend has zero
   * first and second derivatives at the outside join and interior plateau.
   */
  joinWidth: number;
  /** Blend from the supplied host to the local loft, in [0,1]; zero is exact identity. */
  influence: number;
}

/**
 * Own one nasal loft and evaluate its signed head-Z displacement in millimetres.
 * Surface vertices and nasal-rim samples call this same evaluator before the
 * nose performs aperture fitting and attaches its lining. The datum is supplied
 * by that component's socket, so translating the host translates the shape.
 *
 * Cubic de Boor evaluation uses open uniform knots, while numerical inversion
 * of the strictly increasing X/Y curves maps physical coordinates to their
 * parameters. Thirty-six bisections leave a parameter interval of 2^-36;
 * its physical width is bounded by 3*(count-3)*largestPoleGap*2^-36 mm,
 * the cubic derivative bound for these open uniform knots. The loft is
 * continuous in both physical axes and cannot acquire
 * an overshoot from a data-dependent tangent limiter.
 *
 * Outside the rectangle and exactly on its border, the result is zero. Inside,
 * a symmetric quintic transition blends the host depth toward the loft. The
 * original host remains the boundary datum; no detached nasal overlay is made.
 * Head-Z displacement can move projected image XY under an oblique source pose.
 * That drift must be measured rather than called exact source correspondence.
 */
export const createPortraitNasalSection = (
  input: IPortraitNasalSection,
): ((point: readonly number[], datum: readonly number[]) => number) => {
  const transverse = [...input.transverse];
  const heights = input.stations.map((station) => station.height);
  const depths = input.stations.map((station) => [...station.depths]);
  const { joinWidth, influence } = input;
  const axes = [transverse, heights];
  if (
    axes.some(
      (axis) =>
        axis.length < 4 ||
        axis.length > 64 ||
        axis.some(
          (value, i) =>
            !Number.isFinite(value) || (i > 0 && value <= axis[i - 1]),
        ) ||
        !Number.isFinite(axis[axis.length - 1] - axis[0]),
    ) ||
    depths.some(
      (row) => row.length !== transverse.length || !row.every(Number.isFinite),
    ) ||
    !Number.isFinite(joinWidth) ||
    joinWidth <= 0 ||
    axes.some((axis) => joinWidth > (axis[axis.length - 1] - axis[0]) / 2) ||
    !Number.isFinite(influence) ||
    influence < 0 ||
    influence > 1
  )
    throw new Error(
      "Nasal sections need ordered finite cubic controls, a bounded join and influence in [0,1].",
    );

  // Clamped open knots repeat each endpoint four times. Each denominator below
  // spans a nonempty knot interval for the current de Boor recursion level.
  const cubic = (values: readonly number[], t: number): number => {
    const count = values.length;
    const knot = (i: number): number =>
      Math.max(0, Math.min(1, (i - 3) / (count - 3)));
    const span = Math.min(count - 1, 3 + Math.floor(t * (count - 3)));
    const selected = values.slice(span - 3, span + 1);
    for (let level = 1; level <= 3; level++)
      for (let i = 3; i >= level; i--) {
        const start = knot(span - 3 + i);
        const alpha = Math.max(
          0,
          Math.min(1, (t - start) / (knot(span + i + 1 - level) - start)),
        );
        const a = selected[i - 1],
          b = selected[i];
        // Roundoff must not escape the same convex interval the exact spline
        // guarantees. This also preserves a constant control row exactly.
        selected[i] = Math.max(
          Math.min(a, b),
          Math.min(Math.max(a, b), a * (1 - alpha) + b * alpha),
        );
      }
    return selected[3];
  };
  const parameter = (axis: readonly number[], coordinate: number): number => {
    let low = 0,
      high = 1;
    for (let i = 0; i < 36; i++) {
      const middle = (low + high) / 2;
      if (cubic(axis, middle) < coordinate) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };
  // Evaluating only the lower half avoids a rounded result greater than one
  // near the upper endpoint, while retaining the same exact quintic function.
  const transition = (t: number): number => {
    const s = Math.min(t, 1 - t);
    const value = s * s * s * (10 + s * (-15 + 6 * s));
    return t <= 0.5 ? value : 1 - value;
  };
  return (point, datum) => {
    if ([point, datum].some((p) => p.length !== 3 || !p.every(Number.isFinite)))
      throw new Error(
        "A nasal section needs finite XYZ points and a finite datum.",
      );
    const x = point[0] - datum[0],
      y = point[1] - datum[1];
    if (![x, y].every(Number.isFinite))
      throw new Error("A nasal section exceeds its representable local frame.");
    const horizontal = Math.min(
      x - transverse[0],
      transverse[transverse.length - 1] - x,
    );
    const vertical = Math.min(y - heights[0], heights[heights.length - 1] - y);
    if (influence === 0 || horizontal <= 0 || vertical <= 0) return 0;
    const u = parameter(transverse, x),
      v = parameter(heights, y);
    const target =
      datum[2] +
      cubic(
        depths.map((row) => cubic(row, u)),
        v,
      );
    // Separate axis transitions multiply, retaining smooth corner joins. One
    // minimum over all four edges would introduce diagonal derivative changes
    // where the nearest edge switches inside a corner's transition region.
    const weight =
      influence *
      transition(Math.min(1, horizontal / joinWidth)) *
      transition(Math.min(1, vertical / joinWidth));
    const result = (target - point[2]) * weight;
    if (!Number.isFinite(result))
      throw new Error(
        "The nasal section exceeds its representable depth range.",
      );
    return result;
  };
};
