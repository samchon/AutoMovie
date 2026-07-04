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
 * <boolean>)` for floating-point comparisons — these helpers just build that
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
