import {
  AutoMovieViolationKind,
  IAutoMovieQuaternion,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Boolean closeness/violation predicates used inside `TestValidator.predicate`.
 *
 * The project's convention (mirroring interia) is to assert with
 * `TestValidator.equals` for exact values and `TestValidator.predicate(title,
 * <boolean>)` for floating-point comparisons. These helpers just build that
 * boolean, they never throw.
 */
export const nclose = (a: number, b: number, eps = 1e-6): boolean =>
  Number.isFinite(a) && Math.abs(a - b) <= eps;

export const vclose = (
  v: IAutoMovieVector3,
  e: IAutoMovieVector3,
  eps = 1e-6,
): boolean =>
  nclose(v.x, e.x, eps) && nclose(v.y, e.y, eps) && nclose(v.z, e.z, eps);

/** True when two quaternions describe the same rotation (equal up to sign). */
export const qclose = (
  q: IAutoMovieQuaternion,
  e: IAutoMovieQuaternion,
  eps = 1e-6,
): boolean => {
  const dot = q.x * e.x + q.y * e.y + q.z * e.z + q.w * e.w;
  return Math.abs(Math.abs(dot) - 1) <= eps;
};

export const qunit = (q: IAutoMovieQuaternion, eps = 1e-6): boolean =>
  nclose(Math.hypot(q.x, q.y, q.z, q.w), 1, eps);

/**
 * True when a synchronous task throws an Error whose message contains every
 * requested fragment.
 */
export const throwsError = (
  task: () => unknown,
  messageIncludes: string | readonly string[] = [],
): boolean => {
  const fragments =
    typeof messageIncludes === "string" ? [messageIncludes] : messageIncludes;
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      fragments.every((fragment) => error.message.includes(fragment))
    );
  }
};

/** True when the validation failed with at least one matching violation. */
export const hasViolation = (
  v: IAutoMovieValidation,
  kind: AutoMovieViolationKind,
  pathIncludes: string,
): boolean =>
  v.success === false &&
  v.violations.some((x) => x.kind === kind && x.path.includes(pathIncludes));

/** Number of violations in a validation result (0 when it succeeded). */
export const violationCount = (v: IAutoMovieValidation): number =>
  v.success === true ? 0 : v.violations.length;

/**
 * True when the validation succeeded but carries a matching warning: the
 * physical-plausibility advice tier, which surfaces without failing.
 */
const hasWarning = (
  v: IAutoMovieValidation,
  kind: AutoMovieViolationKind,
  pathIncludes: string,
): boolean =>
  v.success === true &&
  (v.warnings ?? []).some(
    (x) => x.kind === kind && x.path.includes(pathIncludes),
  );

/** Preserve one expected warning's complete validation when it is absent. */
export const validationHasWarning = (
  context: string,
  validation: IAutoMovieValidation,
  kind: AutoMovieViolationKind,
  pathIncludes: string,
): boolean => {
  const matches = hasWarning(validation, kind, pathIncludes);
  if (matches === false) reportValidation(context, validation);
  return matches;
};

/** Preserve validation evidence when its warning count is not exactly expected. */
export const validationHasWarningCount = (
  context: string,
  validation: IAutoMovieValidation,
  expected: number,
): boolean => {
  const matches =
    validation.success === true &&
    (validation.warnings ?? []).length === expected;
  if (matches === false) reportValidation(context, validation);
  return matches;
};

/** Preserve validation evidence when no warning was produced. */
export const validationHasWarnings = (
  context: string,
  validation: IAutoMovieValidation,
): boolean => {
  const matches =
    validation.success === true && (validation.warnings ?? []).length > 0;
  if (matches === false) reportValidation(context, validation);
  return matches;
};

/** Preserve one positive validation attempt's evidence when it is not clean. */
export const validationHasNoWarnings = (
  context: string,
  validation: IAutoMovieValidation,
): boolean => {
  const clean =
    validation.success === true && (validation.warnings ?? []).length === 0;
  if (clean === false) reportValidation(context, validation);
  return clean;
};

const reportValidation = (
  context: string,
  validation: IAutoMovieValidation,
): void =>
  console.error(
    `${context} validation:\n${JSON.stringify(validation, null, 2)}`,
  );
