import {
  AutoFilmViolationKind,
  IAutoFilmConstraintViolation,
  IAutoFilmValidation,
} from "@autofilm/interface";

/** Build one {@link IAutoFilmConstraintViolation}. */
export const violation = (
  kind: AutoFilmViolationKind,
  path: string,
  expected: string,
  value: unknown,
): IAutoFilmConstraintViolation => ({ kind, path, expected, value });

/** Wrap a violation list into an {@link IAutoFilmValidation} (success iff empty). */
export const toValidation = (
  violations: IAutoFilmConstraintViolation[],
): IAutoFilmValidation =>
  violations.length === 0 ? { success: true } : { success: false, violations };

/**
 * A small append-only sink for violations, so each validator can push with a
 * stable path prefix without threading arrays through every call.
 */
export class ViolationCollector {
  public readonly items: IAutoFilmConstraintViolation[] = [];

  public push(
    kind: AutoFilmViolationKind,
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

  public toValidation(): IAutoFilmValidation {
    return toValidation(this.items);
  }
}
