import {
  asArray,
  isRecord,
  pushViolation,
  toValidation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateRange,
  validateShotArtifact as validateShotStructure,
  validateSpace,
  validateUniqueIds,
} from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSpace,
  IAutoMovieValidation,
} from "@automovie/interface";

import { IAutoMovieMcpGeometryModel, IAutoMovieMcpMotion } from "../dto";
import {
  appendValidation,
  validateColorArtifact,
  validateTransformArtifact,
} from "./primitives";
import { validateSpaceShape } from "./space";

/**
 * Shared artifact validators over the MCP-facing scene/shot/sequence shapes,
 * consumed by both the standalone `validate*` tools and the `commit*`
 * preconditions, so a commit can never accept what validation would reject.
 */

export const validateSceneArtifact = (
  scene: IAutoMovieScene,
  models: IAutoMovieMcpGeometryModel[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(scene, "$input", "scene", violations))
    return toValidation(violations);
  validateNonEmptyId(scene.id, "$input.id", "scene id", violations);
  validateUniqueIds(scene.nodes, "$input.nodes", "scene node id", violations);
  validateUniqueIds(scene.cameras, "$input.cameras", "camera id", violations);
  validateUniqueIds(scene.lights, "$input.lights", "light id", violations);
  validateUniqueIds(models, "$models", "model id", violations);
  asArray(models).forEach((model, i) => {
    const path = `$models[${i}]`;
    if (!validateObjectArtifact(model, path, "model", violations)) return;
    validateNonEmptyId(model.id, `${path}.id`, "model id", violations);
  });

  const modelIds = new Set(
    asArray(models)
      .filter(isRecord)
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string"),
  );
  asArray(scene.nodes).forEach((node, i) => {
    const path = `$input.nodes[${i}]`;
    if (!validateObjectArtifact(node, path, "scene node", violations)) return;
    validateNonEmptyId(node.id, `${path}.id`, "scene node id", violations);
    validateNonEmptyId(
      node.model,
      `${path}.model`,
      "scene node model",
      violations,
    );
    if (typeof node.model === "string" && !modelIds.has(node.model))
      pushViolation(
        violations,
        "type",
        `${path}.model`,
        `scene node model "${node.model}" must reference an available model id`,
        node.model,
      );
    validateTransformArtifact(
      node.transform,
      `${path}.transform`,
      "scene node transform",
      violations,
    );
  });

  asArray(scene.cameras).forEach((camera, i) => {
    const path = `$input.cameras[${i}]`;
    if (!validateObjectArtifact(camera, path, "camera", violations)) return;
    validateNonEmptyId(camera.id, `${path}.id`, "camera id", violations);
    validateTransformArtifact(
      camera.transform,
      `${path}.transform`,
      "camera transform",
      violations,
    );
    validateRange(
      camera.fovY,
      `${path}.fovY`,
      0,
      180,
      "camera fovY",
      violations,
      false,
    );
    validateRange(
      camera.near,
      `${path}.near`,
      0,
      Infinity,
      "camera near",
      violations,
      false,
    );
    const near = typeof camera.near === "number" ? camera.near : NaN;
    const far = typeof camera.far === "number" ? camera.far : NaN;
    if (!Number.isFinite(far) || far <= near)
      pushViolation(
        violations,
        "range",
        `${path}.far`,
        `camera far must be finite and greater than near (${camera.near}), but was ${camera.far}`,
        camera.far,
      );
  });

  asArray(scene.lights).forEach((light, i) => {
    const path = `$input.lights[${i}]`;
    if (!validateObjectArtifact(light, path, "light", violations)) return;
    validateNonEmptyId(light.id, `${path}.id`, "light id", violations);
    validateTransformArtifact(
      light.transform,
      `${path}.transform`,
      "light transform",
      violations,
    );
    validateColorArtifact(light.color, `${path}.color`, violations);
    validateRange(
      light.intensity,
      `${path}.intensity`,
      0,
      Infinity,
      "light intensity",
      violations,
    );
    if (light.type === "point" || light.type === "spot")
      validateRange(
        light.range,
        `${path}.range`,
        0,
        Infinity,
        "light range",
        violations,
      );
    if (light.type === "spot")
      validateRange(
        light.coneAngle,
        `${path}.coneAngle`,
        0,
        90,
        "spot coneAngle",
        violations,
        false,
      );
  });

  // The ground the feet obey (#1173). Absent or null is the pre-space scalar
  // plane, so only a declared space is checked, and it needs NO model: a
  // surface is semantics plus, in the viewer, generated geometry, never a
  // registry entry, so the model-resolution gate above deliberately ignores it.
  const space = scene.space ?? null;
  if (space !== null && validateSpaceShape(space, "$input.space", violations))
    appendValidation(
      violations,
      remapSpaceViolations(validateSpace({ space: space as IAutoMovieSpace })),
    );

  return toValidation(violations);
};

/** Re-root `validateSpace`'s own `$input` paths under the scene's `space`. */
const remapSpaceViolations = (
  validation: IAutoMovieValidation,
): IAutoMovieValidation =>
  validation.success === false
    ? {
        success: false,
        violations: validation.violations.map((item) => ({
          ...item,
          path: item.path.replace("$input", "$input.space"),
        })),
      }
    : validation;

/**
 * The shot artifact as this host accepts it: the engine's structural contract
 * ({@link validateShotStructure}) plus the one question that belongs to the
 * host, whether the motion registry it was handed actually supplies every clip
 * the shot references.
 *
 * The structural half deliberately does NOT live here. It is the contract the
 * engine's own `performShot` must satisfy, and keeping a second copy beside the
 * commit gate is what let a produced shot pass one definition and fail the
 * other five separate times (#1320).
 */
export const validateShotArtifact = (
  shot: IAutoMovieShot,
  scene: IAutoMovieScene,
  motions: Record<string, IAutoMovieMcpMotion> | undefined,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  // The registry's own shape, addressed where the caller passed it. Absent means
  // "do not cross-check references", which an explicit-slate commit relies on.
  const motionIds = (() => {
    if (motions === undefined) return null;
    if (!isRecord(motions)) {
      pushViolation(
        violations,
        "type",
        "$motions",
        "motion registry must be a JSON object",
        motions,
      );
      return new Set<string>();
    }
    const ids = new Set<string>();
    Object.entries(motions).forEach(([key, motion]) => {
      const path = `$motions.${key}`;
      if (
        !validateObjectArtifact(
          motion,
          path,
          "motion registry entry",
          violations,
        )
      )
        return;
      validateNonEmptyId(motion.id, `${path}.id`, "motion id", violations);
      if (typeof motion.id === "string") ids.add(motion.id);
    });
    return ids;
  })();
  appendValidation(violations, validateShotStructure(shot, scene, motionIds));
  return toValidation(violations);
};

export const validateSequenceArtifact = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(sequence, "$input", "sequence", violations))
    return toValidation(violations);
  validateNonEmptyId(sequence.id, "$input.id", "sequence id", violations);
  validateRange(
    sequence.fps,
    "$input.fps",
    0,
    Infinity,
    "sequence fps",
    violations,
    false,
  );
  validateUniqueIds(shots, "$shots", "shot id", violations);
  asArray(shots).forEach((shot, i) => {
    const path = `$shots[${i}]`;
    if (!validateObjectArtifact(shot, path, "shot", violations)) return;
    validateNonEmptyId(shot.id, `${path}.id`, "shot id", violations);
    // cutSequence's played-span gate (#1008): a non-positive registry shot
    // duration would flow into runtime sums (captions, render targets) as a
    // silently nonsensical negative frame count.
    if (
      typeof shot.duration !== "number" ||
      !Number.isFinite(shot.duration) ||
      shot.duration <= 0
    )
      pushViolation(
        violations,
        "range",
        `${path}.duration`,
        `referenced shot "${String(shot.id)}" duration must be a finite number > 0 seconds, but was ${String(shot.duration)}`,
        shot.duration,
      );
  });
  const shotsById = new Map(
    asArray(shots)
      .filter(isRecord)
      .filter((shot) => typeof shot.id === "string")
      .map((shot) => [shot.id as string, shot as unknown as IAutoMovieShot]),
  );

  // cutSequence's minimum-entries gate: an empty cut-list is not a film, and
  // this validator also guards the resident film.json slice on load, looser
  // here meant an empty film validated clean, then the engine's cut refused
  // it (#1097). The validator/engine no-drift promise binds both directions.
  if (
    validateArrayArtifact(
      sequence.shots,
      "$input.shots",
      "sequence shots",
      violations,
    ) &&
    sequence.shots.length === 0
  )
    pushViolation(
      violations,
      "type",
      "$input.shots",
      "a film must contain at least one shot",
      sequence.shots,
    );
  const entries = asArray(sequence.shots);
  // cutSequence's adjacent-transition accumulator (#988): a valid incoming
  // transition on the previous entry narrows how much of its played span the
  // NEXT transition may consume, or three entries overlap at one instant.
  let previousIncoming = 0;
  entries.forEach((entry, i) => {
    const path = `$input.shots[${i}]`;
    let incoming = 0;
    if (!validateObjectArtifact(entry, path, "sequence entry", violations)) {
      previousIncoming = incoming;
      return;
    }
    validateNonEmptyId(entry.shot, `${path}.shot`, "sequence shot", violations);
    const shot =
      typeof entry.shot === "string" ? shotsById.get(entry.shot) : undefined;
    if (shot === undefined)
      pushViolation(
        violations,
        "type",
        `${path}.shot`,
        `sequence shot "${entry.shot}" must reference an available shot`,
        entry.shot,
      );
    if (entry.trim === undefined)
      pushViolation(
        violations,
        "type",
        `${path}.trim`,
        "sequence trim must be null or an object",
        entry.trim,
      );
    else if (entry.trim !== null)
      validateTrim(
        entry.trim,
        shot?.duration ?? Infinity,
        `${path}.trim`,
        violations,
      );
    if (entry.transition === undefined) {
      pushViolation(
        violations,
        "type",
        `${path}.transition`,
        "sequence transition must be null or an object",
        entry.transition,
      );
    } else if (entry.transition !== null) {
      if (i === 0)
        pushViolation(
          violations,
          "temporal",
          `${path}.transition`,
          "the first sequence entry cannot have an incoming transition",
          entry.transition,
        );
      validateTransition(entry.transition, `${path}.transition`, violations);
      const current = entryDuration(entry, shot);
      const previousEntry = entries[i - 1];
      const previous =
        !isRecord(previousEntry) || typeof previousEntry.shot !== "string"
          ? null
          : entryDuration(previousEntry, shotsById.get(previousEntry.shot));
      const transitionDuration =
        isRecord(entry.transition) &&
        typeof entry.transition.duration === "number"
          ? entry.transition.duration
          : NaN;
      if (
        previous !== null &&
        current !== null &&
        Number.isFinite(transitionDuration)
      ) {
        if (transitionDuration > Math.min(previous, current))
          pushViolation(
            violations,
            "temporal",
            `${path}.transition.duration`,
            `transition duration must fit adjacent entries, but was ${transitionDuration}`,
            transitionDuration,
          );
        else if (previousIncoming + transitionDuration > previous)
          pushViolation(
            violations,
            "temporal",
            `${path}.transition.duration`,
            `adjacent transitions (${previousIncoming}s + ${transitionDuration}s) must not overlap inside the previous entry's played span (${previous}s)`,
            transitionDuration,
          );
        else incoming = transitionDuration;
      }
    }
    previousIncoming = incoming;
  });

  return toValidation(violations);
};

const validateTrim = (
  trim: unknown,
  shotDuration: number,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(trim, path, "sequence trim", violations)) return;
  validateRange(
    trim.start,
    `${path}.start`,
    0,
    Infinity,
    "trim start",
    violations,
  );
  validateRange(
    trim.duration,
    `${path}.duration`,
    0,
    Infinity,
    "trim duration",
    violations,
    false,
  );
  const start = typeof trim.start === "number" ? trim.start : NaN;
  const duration = typeof trim.duration === "number" ? trim.duration : NaN;
  if (
    Number.isFinite(shotDuration) &&
    Number.isFinite(start) &&
    Number.isFinite(duration) &&
    start + duration > shotDuration
  )
    pushViolation(
      violations,
      "temporal",
      path,
      `trim start + duration must fit within shot duration ${shotDuration}`,
      trim,
    );
};

const validateTransition = (
  transition: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (
    !validateObjectArtifact(transition, path, "sequence transition", violations)
  )
    return;
  validateRange(
    transition.duration,
    `${path}.duration`,
    0,
    Infinity,
    "transition duration",
    violations,
    false,
  );
};

// Both call sites gate `entry` through `isRecord` first, so the parameter is
// already narrowed, an unreachable defensive re-check here would be dead
// code the coverage gate rightly refuses to count (#1040).
const entryDuration = (
  entry: Record<string, unknown>,
  shot: IAutoMovieShot | undefined,
): number | null => {
  if (shot === undefined) return null;
  if (isRecord(entry.trim) && typeof entry.trim.duration === "number")
    return entry.trim.duration;
  return shot.duration;
};
