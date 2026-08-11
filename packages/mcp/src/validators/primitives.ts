import {
  asArray,
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
 * diagnostic is assembled from, plus the few MCP-layer rules that more than one
 * gate must apply identically. A rule with two gates lives here once rather
 * than in each of them, which is the drift #1320 traced to its root.
 */

export const appendValidation = (
  violations: IAutoMovieConstraintViolation[],
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === false) violations.push(...validation.violations);
};

/**
 * Append one path-located finding when a value is not non-empty text.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope Preserves the caller's exact field path.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope Keeps the primitive refusal addressable.
 */
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

/**
 * Append deterministic structural and range findings for one transform.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Emits component findings in a stable axis order.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Keeps transform validation reproducible.
 */
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

const validateQuaternionArtifact = (
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

/**
 * Append path-located range findings for one RGBA color artifact.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-cause-observed-expected Retains the offending channel value in its finding.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-cause-values Preserves the observed value and exact channel path.
 */
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

/**
 * Beat ids whose per-beat slice filenames would clobber each other on a
 * case-insensitive filesystem (`shots/<beat>.json`, `beatEnds/<beat>.json`).
 *
 * Both gates over a script apply it: the commit gate, and the resident store's
 * `script.json` read gate. The read gate's whole population is files this
 * server did not write, or wrote under an older version, so a hand-edited or
 * legacy script carrying the collision used to load clean and resurface as the
 * store's raw mid-save throw at the SECOND colliding beat's `commitShot`, after
 * the non-keyed slices were rewritten. That is the exact symptom #1096 removed
 * for submitted scripts, reached from disk instead (#1327).
 *
 * Exact duplicates keep their own `validateUniqueBy` violation, so one bad pair
 * yields one violation rather than two.
 *
 * The fold is over the raw id, not over `sliceFilename`'s encoding of it. That
 * refuses a marginal pair the store would in fact tolerate (`con` and `Con`
 * escape to distinct filenames), which is the safe direction: relaxing a
 * refusal that has stood since #1096 needs a product reason, not a symmetry
 * argument.
 */
export const validateBeatIdCaseCollisions = (
  beats: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const byLower = new Map<string, { id: string; index: number }>();
  asArray(beats).forEach((beat, index) => {
    if (!isRecord(beat) || typeof beat.id !== "string") return;
    const lower = beat.id.toLowerCase();
    const prior = byLower.get(lower);
    if (prior !== undefined && prior.id !== beat.id)
      pushViolation(
        violations,
        "type",
        `${path}[${index}].id`,
        `beat id "${beat.id}" collides case-insensitively with "${prior.id}" (${path}[${prior.index}].id); their per-beat slice files would clobber on a case-insensitive filesystem, rename one beat`,
        beat.id,
      );
    if (prior === undefined) byLower.set(lower, { id: beat.id, index });
  });
};
