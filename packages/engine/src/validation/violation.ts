import {
  automovieViolationKind,
  IautomovieConstraintViolation,
  IautomovieValidation,
} from "@automovie/interface";

/** Build one {@link IautomovieConstraintViolation}. */
export const violation = (
  kind: automovieViolationKind,
  path: string,
  expected: string,
  value: unknown,
  overshoot?: number,
): IautomovieConstraintViolation =>
  overshoot === undefined
    ? { kind, path, expected, value }
    : { kind, path, expected, value, overshoot };

/** Wrap a violation list into an {@link IautomovieValidation} (success iff empty). */
export const toValidation = (
  violations: IautomovieConstraintViolation[],
): IautomovieValidation =>
  violations.length === 0 ? { success: true } : { success: false, violations };

/**
 * A small append-only sink for violations, so each validator can push with a
 * stable path prefix without threading arrays through every call.
 */
export class ViolationCollector {
  public readonly items: IautomovieConstraintViolation[] = [];

  public push(
    kind: automovieViolationKind,
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

  public toValidation(): IautomovieValidation {
    return toValidation(this.items);
  }
}
