import {
  AutoMovieViolationKind,
  IAutoMovieConstraintViolation,
  IAutoMovieValidation,
} from "@automovie/interface";

/** Build one {@link IAutoMovieConstraintViolation}. Defaults to `"error"`. */
export const violation = (
  kind: AutoMovieViolationKind,
  path: string,
  expected: string,
  value: unknown,
  overshoot?: number,
  severity: "error" | "warning" = "error",
): IAutoMovieConstraintViolation =>
  overshoot === undefined
    ? { kind, path, expected, value, severity }
    : { kind, path, expected, value, overshoot, severity };

/**
 * Wrap a violation list into an {@link IAutoMovieValidation}. Any
 * `"error"`-severity violation fails the run (and the whole list, warnings
 * included, rides along for the correction round); a list of only `"warning"`s
 * still succeeds but surfaces them; an empty list is a clean success.
 */
export const toValidation = (
  violations: IAutoMovieConstraintViolation[],
): IAutoMovieValidation => {
  if (violations.some((v) => v.severity === "error"))
    return { success: false, violations };
  if (violations.length > 0) return { success: true, warnings: violations };
  return { success: true };
};

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
    severity: "error" | "warning" = "error",
  ): void {
    this.items.push(
      violation(kind, path, expected, value, overshoot, severity),
    );
  }

  /**
   * Push a `"warning"`-severity violation, physical-plausibility advice that
   * does not fail validation (see
   * {@link IAutoMovieConstraintViolation.severity}).
   */
  public warn(
    kind: AutoMovieViolationKind,
    path: string,
    expected: string,
    value: unknown,
    overshoot?: number,
  ): void {
    this.push(kind, path, expected, value, overshoot, "warning");
  }

  /** Finite range check `[min, max]`; pushes a `range` violation if outside. */
  public range(
    path: string,
    value: number,
    min: number,
    max: number,
    label = "value",
  ): void {
    if (!Number.isFinite(value) || value < min || value > max)
      this.push(
        "range",
        path,
        `${label} must be a finite number within [${min}, ${max}], but was ${value}`,
        value,
      );
  }

  public toValidation(): IAutoMovieValidation {
    return toValidation(this.items);
  }
}
