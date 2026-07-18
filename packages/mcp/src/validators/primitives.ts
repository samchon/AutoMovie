import { violation } from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieValidation,
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateObjectArtifact = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): value is Record<string, unknown> => {
  if (isRecord(value)) return true;
  pushViolation(
    violations,
    "type",
    path,
    `${label} must be a JSON object`,
    value,
  );
  return false;
};

export const validateArrayArtifact = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): value is unknown[] => {
  if (Array.isArray(value)) return true;
  pushViolation(violations, "type", path, `${label} must be an array`, value);
  return false;
};

export const validateUniqueIds = (
  items: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(items, path, label, violations)) return;
  validateUniqueBy(
    items.map((item, index) => ({
      id: isRecord(item) ? item.id : undefined,
      path: `${path}[${index}].id`,
    })),
    label,
    violations,
  );
};

export const validateUniqueBy = (
  entries: { id: unknown; path: string }[],
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.id !== "string") continue;
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
  id: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof id !== "string") {
    pushViolation(violations, "type", path, `${label} must be a string`, id);
    return;
  }
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

export const validateVectorArtifact = (
  vector: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(vector, path, label, violations)) return;
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

export const validateRange = (
  value: unknown,
  path: string,
  min: number,
  max: number,
  label: string,
  violations: IAutoMovieConstraintViolation[],
  inclusiveMin = true,
): void => {
  const numeric = typeof value === "number" ? value : NaN;
  const aboveMin = inclusiveMin ? numeric >= min : numeric > min;
  const belowMax = max === Infinity ? true : numeric <= max;
  if (!Number.isFinite(numeric) || !aboveMin || !belowMax)
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

/**
 * A pixel dimension usable as an encoded frame size: a positive EVEN whole
 * number. `yuv420p` chroma subsampling halves each axis, so an odd width or
 * height cannot be encoded without a silent rounding — and a silent rounding is
 * exactly what would desync the pose-keypoint sidecar's `width/height` aspect
 * from the rendered frame the render pins with `-s` (#1231/#1251). Finiteness
 * and positivity are a preceding {@link validateRange}'s job; this adds only the
 * even-whole-number constraint and stays silent on values `validateRange`
 * already rejects, so one bad dimension yields one violation, not two.
 */
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
