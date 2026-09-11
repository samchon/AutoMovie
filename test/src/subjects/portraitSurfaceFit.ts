/**
 * A depth-preserving thin-plate residual for one recorded anatomical surface.
 * Centres use coordinates divided by scale; coefficient outputs are millimetres.
 * The generated record also carries its source/configuration digests.
 * @author Samchon
 */
export interface IPortraitSurfaceFit {
  scale: number;
  centres: number[][];
  weights: number[][];
  /** Coefficient rows for [1,x,y,z], with two output coordinates per row. */
  affine: number[][];
  gazeOrigins?: number[][];
  viewRay?: number[];
}

/**
 * Evaluate phi(r)=r^2 log(r), with phi(0)=0, plus the fitted affine terms.
 * Squared distance gives phi=.5*rSquared*log(rSquared). Only X/Y move; Z remains
 * on the anatomical prior. The offline fit chooses X/Y constraints that preserve
 * the reference photograph's projection despite its different inferred depth.
 */
export function createPortraitSurfaceFitter(input: IPortraitSurfaceFit) {
  const fit = structuredClone(input);
  if (
    !Number.isFinite(fit.scale) ||
    fit.scale <= 0 ||
    fit.centres.length !== fit.weights.length ||
    fit.affine.length !== 4 ||
    fit.centres.some((p) => p.length !== 3 || !p.every(Number.isFinite)) ||
    [...fit.weights, ...fit.affine].some(
      (p) => p.length !== 2 || !p.every(Number.isFinite),
    )
  )
    throw new Error(
      "Surface fitting needs finite aligned centres, coefficients and positive scale.",
    );
  return (point: readonly number[]): number[] => {
    if (point.length !== 3 || !point.every(Number.isFinite))
      throw new Error("Surface fitting needs a finite XYZ point.");
    // Normalized inputs are dimensionless. Expand the fixed three-coordinate
    // arithmetic so a dense skin does not allocate a callback per radial centre.
    const x = point[0] / fit.scale,
      y = point[1] / fit.scale,
      z = point[2] / fit.scale;
    let dx =
      fit.affine[0][0] +
      fit.affine[1][0] * x +
      fit.affine[2][0] * y +
      fit.affine[3][0] * z;
    let dy =
      fit.affine[0][1] +
      fit.affine[1][1] * x +
      fit.affine[2][1] * y +
      fit.affine[3][1] * z;
    for (let i = 0; i < fit.centres.length; i++) {
      const a = x - fit.centres[i][0],
        b = y - fit.centres[i][1],
        c = z - fit.centres[i][2];
      const squared = a * a + b * b + c * c;
      const kernel = squared === 0 ? 0 : 0.5 * squared * Math.log(squared);
      dx += fit.weights[i][0] * kernel;
      dy += fit.weights[i][1] * kernel;
    }
    const result = [point[0] + dx, point[1] + dy, point[2]];
    if (!result.every(Number.isFinite))
      throw new Error("Fitted surface exceeds its representable range.");
    return result;
  };
}
