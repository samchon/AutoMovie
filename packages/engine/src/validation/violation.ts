import {
  AutoMovieViolationKind,
  IAutoMovieConstraintViolation,
  IAutoMovieValidation,
} from "@automovie/interface";

/** Build one {@link IAutoMovieConstraintViolation}. */
export const violation = (
  kind: AutoMovieViolationKind,
  path: string,
  expected: string,
  value: unknown,
  overshoot?: number,
): IAutoMovieConstraintViolation =>
  overshoot === undefined
    ? { kind, path, expected, value }
    : { kind, path, expected, value, overshoot };

/**
 * Wrap a violation list into an {@link IAutoMovieValidation} (success iff
 * empty).
 */
export const toValidation = (
  violations: IAutoMovieConstraintViolation[],
): IAutoMovieValidation =>
  violations.length === 0 ? { success: true } : { success: false, violations };

/**
 * A small append-only sink for violations, so each validator can push with a
 * stable path prefix without threading arrays through every call.
 */
export class ViolationCollector {
  public readonly items: IAutoMovieConstraintViolation[] = [];

  public push(
    kind: AutoMovieViolationKind,
    path: string,
    expected: string,
    value: unknown,
    overshoot?: number,
  ): void {
    this.items.push(violation(kind, path, expected, value, overshoot));
  }

  /** Range check `[min, max]`; pushes a `range` violation if outside. */
  public range(
    path: string,
    value: number,
    min: number,
    max: number,
    label = "value",
  ): void {
    if (value < min || value > max)
      this.push(
        "range",
        path,
        `${label} must be within [${min}, ${max}], but was ${value}`,
        value,
      );
  }

  public toValidation(): IAutoMovieValidation {
    return toValidation(this.items);
  }
}
