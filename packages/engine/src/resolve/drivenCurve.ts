import { IAutoMovieDrivenCurve } from "@automovie/interface";

/**
 * Evaluate a nonlinear driven-key curve.
 *
 * The curve is validated here because it is authored data crossing the engine
 * boundary. Missing source values default to the first authored source point,
 * so nonlinear curves do not depend on the linear driver's `inRange`.
 *
 * @author Samchon
 */
export const evaluateDrivenCurve = (
  source: number | undefined,
  curve: IAutoMovieDrivenCurve,
): number => {
  validateDrivenCurve(curve);
  const points = curve.points;
  const x = source ?? points[0]!.source;
  if (x <= points[0]!.source) return points[0]!.output;
  for (let i = 1; i < points.length; ++i) {
    const next = points[i]!;
    if (x <= next.source) {
      const prev = points[i - 1]!;
      return (
        prev.output +
        (next.output - prev.output) *
          ((x - prev.source) / (next.source - prev.source))
      );
    }
  }
  return points[points.length - 1]!.output;
};

const validateDrivenCurve = (curve: IAutoMovieDrivenCurve): void => {
  if (typeof curve !== "object" || Array.isArray(curve))
    throw new Error("driven driver curve must be an object");
  if (!Array.isArray(curve.points))
    throw new Error("driven driver curve.points must be an array");
  if (curve.points.length === 0)
    throw new Error(
      "driven driver curve.points must contain at least one point",
    );

  let previousSource: number | null = null;
  for (let i = 0; i < curve.points.length; ++i) {
    const point = curve.points[i]!;
    validateDrivenCurvePoint(i, point);
    if (previousSource !== null && point.source <= previousSource)
      throw new Error(
        `driven driver curve.points source values must be strictly increasing, but point ${i} was ${point.source} after ${previousSource}`,
      );
    previousSource = point.source;
  }
};

const validateDrivenCurvePoint = (
  index: number,
  point: IAutoMovieDrivenCurve["points"][number],
): void => {
  if (typeof point !== "object" || point === null || Array.isArray(point))
    throw new Error(
      `driven driver curve.points[${index}] point must be an object`,
    );
  validateDrivenFinite(`curve.points[${index}].source`, point.source);
  validateDrivenFinite(`curve.points[${index}].output`, point.output);
};

const validateDrivenFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`driven driver ${label} must be finite, but was ${value}`);
};
