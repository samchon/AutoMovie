import { violation } from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieQuaternion,
  IAutoMovieScene,
  IAutoMovieTransform,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

const UNIT_QUATERNION_EPSILON = 1e-6;

/**
 * Violation-collection primitives shared by the MCP artifact validators and the
 * commit preconditions — the path-bearing building blocks every `$input...`
 * diagnostic is assembled from.
 */

export const appendValidation = (
  violations: IAutoMovieConstraintViolation[],
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === false) violations.push(...validation.violations);
};

export const validateUniqueIds = <T extends { id: string }>(
  items: T[],
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void =>
  validateUniqueBy(
    items.map((item, index) => ({ id: item.id, path: `${path}[${index}].id` })),
    label,
    violations,
  );

export const validateUniqueBy = (
  entries: { id: string; path: string }[],
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id))
      pushViolation(
        violations,
        "type",
        entry.path,
        `${label} "${entry.id}" must be unique`,
        entry.id,
      );
    seen.add(entry.id);
  }
};

export const validateNonEmptyId = (
  id: string,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (id.trim().length === 0)
    pushViolation(
      violations,
      "type",
      path,
      `${label} must be a non-empty id`,
      id,
    );
};

export const validateNonEmptyText = (
  text: string,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
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
  transform: IAutoMovieTransform,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
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
  for (const axis of ["x", "y", "z"] as const)
    if (transform.scale[axis] <= 0)
      pushViolation(
        violations,
        "range",
        `${path}.scale.${axis}`,
        `${label} scale component must be > 0, but was ${transform.scale[axis]}`,
        transform.scale[axis],
      );
};

export const validateVectorArtifact = (
  vector: IAutoMovieVector3,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(vector[axis]))
      pushViolation(
        violations,
        "range",
        `${path}.${axis}`,
        `${label} component must be finite, but was ${vector[axis]}`,
        vector[axis],
      );
};

export const validateQuaternionArtifact = (
  quaternion: IAutoMovieQuaternion,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  for (const axis of ["x", "y", "z", "w"] as const)
    if (!Number.isFinite(quaternion[axis]))
      pushViolation(
        violations,
        "range",
        `${path}.${axis}`,
        `${label} component must be finite, but was ${quaternion[axis]}`,
        quaternion[axis],
      );
  const length = Math.hypot(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  );
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
  color: IAutoMovieScene["lights"][number]["color"],
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
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

export const validateRange = (
  value: number,
  path: string,
  min: number,
  max: number,
  label: string,
  violations: IAutoMovieConstraintViolation[],
  inclusiveMin = true,
): void => {
  const aboveMin = inclusiveMin ? value >= min : value > min;
  const belowMax = max === Infinity ? true : value <= max;
  if (!Number.isFinite(value) || !aboveMin || !belowMax)
    pushViolation(
      violations,
      "range",
      path,
      max === Infinity
        ? `${label} must be finite and ${inclusiveMin ? ">=" : ">"} ${min}, but was ${value}`
        : `${label} must be finite and within ${inclusiveMin ? "[" : "("}${min}, ${max}], but was ${value}`,
      value,
    );
};

export const pushViolation = (
  violations: IAutoMovieConstraintViolation[],
  kind: IAutoMovieConstraintViolation["kind"],
  path: string,
  expected: string,
  value: unknown,
): void => {
  violations.push(violation(kind, path, expected, value));
};

/**
 * Stored slate slices accepted by MCP query tools.
 *
 * This is narrower than the full production slate so query schemas stay small:
 * film assembly is not needed to read script, scene, shots, notes, or beat-end
 * state.
 */
