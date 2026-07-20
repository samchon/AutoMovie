import {
  isRecord,
  pushViolation,
  validateObjectArtifact,
  validateRange,
  validateVectorArtifact,
} from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieValidation,
} from "@automovie/interface";

/**
 * The structural shape predicates moved to `@automovie/engine` (#1320), so the
 * producer of an artifact and the gate that accepts it share one definition
 * rather than two that drift. Re-exported here because they are still part of
 * this module's surface for the rest of the MCP validators.
 */
export {
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateRange,
  validateUniqueBy,
  validateUniqueIds,
  validateVectorArtifact,
} from "@automovie/engine";

const UNIT_QUATERNION_EPSILON = 1e-6;

/**
 * Violation-collection primitives shared by the MCP artifact validators and the
 * commit preconditions, the path-bearing building blocks every `$input...`
 * diagnostic is assembled from.
 */

export const appendValidation = (
  violations: IAutoMovieConstraintViolation[],
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === false) violations.push(...validation.violations);
};

export const validateNonEmptyText = (
  text: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof text !== "string") {
    pushViolation(violations, "type", path, `${label} must be a string`, text);
    return;
  }
  if (text.trim().length === 0)
    pushViolation(
      violations,
      "type",
      path,
      `${label} must be non-empty text`,
      text,
    );
};

export const validateTransformArtifact = (
  transform: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(transform, path, label, violations)) return;
  validateVectorArtifact(
    transform.translation,
    `${path}.translation`,
    `${label} translation`,
    violations,
  );
  validateQuaternionArtifact(
    transform.rotation,
    `${path}.rotation`,
    `${label} rotation`,
    violations,
  );
  validateVectorArtifact(
    transform.scale,
    `${path}.scale`,
    `${label} scale`,
    violations,
  );
  const scale = transform.scale;
  if (!isRecord(scale)) return;
  for (const axis of ["x", "y", "z"] as const) {
    const value = scale[axis];
    if (typeof value === "number" && value <= 0)
      pushViolation(
        violations,
        "range",
        `${path}.scale.${axis}`,
        `${label} scale component must be > 0, but was ${value}`,
        value,
      );
  }
};

export const validateQuaternionArtifact = (
  quaternion: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(quaternion, path, label, violations)) return;
  for (const axis of ["x", "y", "z", "w"] as const)
    if (!Number.isFinite(quaternion[axis]))
      pushViolation(
        violations,
        "range",
        `${path}.${axis}`,
        `${label} component must be finite, but was ${quaternion[axis]}`,
        quaternion[axis],
      );
  const x = typeof quaternion.x === "number" ? quaternion.x : NaN;
  const y = typeof quaternion.y === "number" ? quaternion.y : NaN;
  const z = typeof quaternion.z === "number" ? quaternion.z : NaN;
  const w = typeof quaternion.w === "number" ? quaternion.w : NaN;
  const length = Math.hypot(x, y, z, w);
  if (Number.isFinite(length) && Math.abs(length - 1) > UNIT_QUATERNION_EPSILON)
    pushViolation(
      violations,
      "range",
      path,
      `${label} must be a unit quaternion (length 1), but length was ${length}`,
      quaternion,
    );
};

export const validateColorArtifact = (
  color: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(color, path, "color", violations)) return;
  for (const channel of ["r", "g", "b"] as const)
    validateRange(
      color[channel],
      `${path}.${channel}`,
      0,
      1,
      channel,
      violations,
    );
  if (color.a !== null)
    validateRange(color.a, `${path}.a`, 0, 1, "alpha", violations);
};

export const validateEvenDimension = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return;
  if (!Number.isInteger(value) || value % 2 !== 0)
    pushViolation(
      violations,
      "range",
      path,
      `${label} must be an even whole number of pixels (yuv420p needs both axes even), but was ${value}`,
      value,
    );
};
