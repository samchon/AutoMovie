/** A fitted 2D similarity (rotation + uniform scale + translation). */
export interface IForgeSimilarity2 {
  /** Uniform scale factor. */
  scale: number;

  /** Rotation about z in radians. */
  rotation: number;

  /** Map one source point (xyz triple) into the destination frame. */
  apply: (point: [number, number, number]) => [number, number, number];
}

/**
 * Fit the least-squares 2D similarity mapping `src` onto `dst`: the alignment
 * step that drops detected landmarks (image px, near-frontal) onto the
 * canonical face frame.
 *
 * Closed form on x/y via the complex-number formulation; z rides along with the
 * same uniform scale and a translation (a 2D fit cannot reflect, so the caller
 * flips image-y up before fitting). Points are flat xyz triples and the arrays
 * must pair up index by index.
 *
 * @author Samchon
 * @throws When the source points are all coincident (no scale is defined)
 */
export const fitSimilarity2 = (
  src: number[],
  dst: number[],
): IForgeSimilarity2 => {
  const n = src.length / 3;
  let cx = 0,
    cy = 0,
    cz = 0,
    bx = 0,
    by = 0,
    bz = 0;
  for (let i = 0; i < n; i++) {
    cx += src[i * 3]! / n;
    cy += src[i * 3 + 1]! / n;
    cz += src[i * 3 + 2]! / n;
    bx += dst[i * 3]! / n;
    by += dst[i * 3 + 1]! / n;
    bz += dst[i * 3 + 2]! / n;
  }
  let mr = 0,
    mi = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i * 3]! - cx;
    const sy = src[i * 3 + 1]! - cy;
    const dx = dst[i * 3]! - bx;
    const dy = dst[i * 3 + 1]! - by;
    mr += sx * dx + sy * dy;
    mi += sx * dy - sy * dx;
    den += sx * sx + sy * sy;
  }
  if (den === 0) throw new Error("degenerate source: all points coincide");
  const ar = mr / den;
  const ai = mi / den;
  const scale = Math.hypot(ar, ai);
  return {
    scale,
    rotation: Math.atan2(ai, ar),
    apply: ([x, y, z]) => {
      const sx = x - cx;
      const sy = y - cy;
      return [
        ar * sx - ai * sy + bx,
        ai * sx + ar * sy + by,
        scale * (z - cz) + bz,
      ];
    },
  };
};
