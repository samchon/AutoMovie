import { IAutoMovieConstraintViolation } from "@automovie/interface";

import { violation } from "./violation";

/**
 * Structural shape predicates over the artifacts the engine emits and consumes.
 *
 * These live in `engine` rather than beside the MCP validators because the
 * question they answer, "is this object internally well formed", belongs to the
 * artifact contract itself, not to any one consumer of it. The producer
 * (`performShot`) and the MCP commit gate must agree about that contract by
 * sharing this code, not by two hand-maintained copies that drift until an
 * artifact passes one and fails the other (#1320).
 *
 * @author Samchon
 */

/** A value as an array, or an empty one: shape errors are reported separately. */
export const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

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
 * height cannot be encoded without a silent rounding, and a silent rounding is
 * exactly what would desync the pose-keypoint sidecar's `width/height` aspect
 * from the rendered frame the render pins with `-s` (#1231/#1251). Finiteness
 * and positivity are a preceding {@link validateRange}'s job; this adds only the
 * even-whole-number constraint and stays silent on values `validateRange`
 * already rejects, so one bad dimension yields one violation, not two.
 */

export const pushViolation = (
  violations: IAutoMovieConstraintViolation[],
  kind: IAutoMovieConstraintViolation["kind"],
  path: string,
  expected: string,
  value: unknown,
): void => {
  violations.push(violation(kind, path, expected, value));
};
