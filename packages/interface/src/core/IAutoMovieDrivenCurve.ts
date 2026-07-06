/**
 * A nonlinear driven-key map from source scalar to output scalar.
 *
 * Points are sorted by `source`. The engine interpolates linearly between
 * adjacent points and holds the first/last output outside the authored range.
 *
 * @author Samchon
 */
export interface IAutoMovieDrivenCurve {
  /** Control points ordered by increasing source value. */
  points: IAutoMovieDrivenCurvePoint[];
}

/**
 * One control point in a driven-key curve.
 *
 * @author Samchon
 */
export interface IAutoMovieDrivenCurvePoint {
  /** Source channel value. */
  source: number;
  /** Output scalar written by the driven driver. */
  output: number;
}
