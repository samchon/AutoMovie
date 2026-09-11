/**
 * Resolve one nasal projection scale from a skin attachment plane. Three
 * subject-owned points span that plane in head XY; height is measured in head
 * Z, in millimetres. All samples, including nostril rims, use the same plane.
 * This changes nasal projection, not lateral width or anatomical tip curvature.
 * Omitted/one scale is exact identity and requires no support points.
 *
 * The plane is solved in coordinates normalized about the first datum. Signed
 * distance from this plane is scaled uniformly, preserving its fixed points.
 * A vertical or unresolved XY plane refuses rather than guessing another axis.
 */
export function createPortraitNasalSupport(
  points: readonly (readonly number[])[],
  scale = 1,
): (point: readonly number[]) => number {
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("Nasal depth scale must be finite and positive.");
  if (scale === 1) return () => 0;
  if (
    points.length !== 3 ||
    points.some((p) => p.length !== 3 || !p.every(Number.isFinite))
  )
    throw new Error(
      "Nasal depth scaling requires three finite skin support points.",
    );
  const origin = [...points[0]];
  const size = Math.max(
    ...points.flatMap((p) => p.map((v, i) => Math.abs(v - origin[i]))),
  );
  if (!Number.isFinite(size) || size === 0)
    throw new Error("Nasal support plane needs a finite nonzero extent.");
  const [u, v] = points
    .slice(1)
    .map((p) => p.map((value, i) => (value - origin[i]) / size));
  const determinant = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(determinant) <= 1e-10)
    throw new Error(
      "Nasal support points must span an unambiguous head-XY plane.",
    );
  const dx = (u[2] * v[1] - u[1] * v[2]) / determinant;
  const dy = (u[0] * v[2] - u[2] * v[0]) / determinant;
  return (point) => {
    if (point.length !== 3 || !point.every(Number.isFinite))
      throw new Error("Nasal support sampling requires finite XYZ.");
    const height =
      point[2] -
      origin[2] -
      dx * (point[0] - origin[0]) -
      dy * (point[1] - origin[1]);
    const displacement = (scale - 1) * height;
    if (!Number.isFinite(displacement))
      throw new Error("Nasal depth displacement exceeds its finite domain.");
    return displacement;
  };
}
