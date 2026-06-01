import {
  IMoticaConstraintViolation,
  IMoticaValidation,
  MoticaViolationKind,
} from "@motica/interface";

/** Build one {@link IMoticaConstraintViolation}. */
export const violation = (
  kind: MoticaViolationKind,
  path: string,
  expected: string,
  value: unknown,
): IMoticaConstraintViolation => ({ kind, path, expected, value });

/** Wrap a violation list into an {@link IMoticaValidation} (success iff empty). */
export const toValidation = (
  violations: IMoticaConstraintViolation[],
): IMoticaValidation =>
  violations.length === 0 ? { success: true } : { success: false, violations };

/**
 * A small append-only sink for violations, so each validator can push with a
 * stable path prefix without threading arrays through every call.
 */
export class ViolationCollector {
  public readonly items: IMoticaConstraintViolation[] = [];

  public push(
    kind: MoticaViolationKind,
    path: string,
    expected: string,
    value: unknown,
  ): void {
    this.items.push(violation(kind, path, expected, value));
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

  public toValidation(): IMoticaValidation {
    return toValidation(this.items);
  }
}
