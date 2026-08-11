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

/**
 * A value as an array, or an empty one: shape errors are reported separately.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `asArray` limits element traversal to actual arrays after a separate shape fault has identified a malformed collection.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `asArray` supplies the empty traversal fallback that prevents invalid collection shapes from creating invented member observations.
 */
export const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/**
 * Whether a value is a non-null, non-array JSON object.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `isRecord` distinguishes structured artifact members from null, arrays, and primitive values before geometry fields are inspected.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `isRecord` establishes the object-shape precondition for member-level numeric and structural checks.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate an artifact object and append a typed violation on mismatch.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateObjectArtifact` rejects a non-record geometry member at the caller-supplied artifact path.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateObjectArtifact` records the observed non-object value and the required JSON-object constraint before nested checks continue.
 */
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

/**
 * Validate an artifact array and append a typed violation on mismatch.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateArrayArtifact` rejects a collection-shaped artifact field that is not an array at its declared member path.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateArrayArtifact` preserves the offending collection value beside the array-shape expectation used by downstream element validation.
 */
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

/**
 * Validate that object-array string ids are unique.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateUniqueIds` locates duplicate string identities at the exact object-array element whose id repeats.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateUniqueIds` derives stable element-id paths before applying the structural uniqueness check.
 */
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

/**
 * Validate uniqueness for an explicit list of ids and source paths.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateUniqueBy` reports each repeated artifact identity at the explicit source path paired with that occurrence.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateUniqueBy` checks declared string identities without substituting traversal order for the caller's member address.
 */
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

/**
 * Validate that an artifact id is a non-empty string.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateNonEmptyId` rejects non-string and blank artifact identities at the id field that supplied them.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateNonEmptyId` retains the observed id value while enforcing the non-empty structural identity constraint.
 */
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

/**
 * Validate a finite three-component vector artifact.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateVectorArtifact` rejects each non-finite coordinate at its own x, y, or z member path.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateVectorArtifact` first proves object shape, then records the offending component value for finite-vector validation.
 */
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

/**
 * Validate a finite numeric value against a configurable interval.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `validateRange` rejects a non-finite or out-of-interval artifact scalar at the supplied numeric field path.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `validateRange` records the observed scalar together with its inclusive or exclusive lower-bound contract and upper limit.
 */
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
 * Record one violation into a collector the caller owns.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `pushViolation` appends one geometry-shape failure without losing the path chosen by the check that discovered it.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `pushViolation` binds kind, expected constraint, and observed value into the caller's ordered artifact diagnostics.
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
