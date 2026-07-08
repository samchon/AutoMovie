import { toValidation } from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";

import { IAutoMovieMcpGeometryModel, IAutoMovieMcpMotion } from "../dto";
import {
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateColorArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateRange,
  validateTransformArtifact,
  validateUniqueBy,
  validateUniqueIds,
} from "./primitives";

/**
 * Shared artifact validators over the MCP-facing scene/shot/sequence shapes —
 * consumed by both the standalone `validate*` tools and the `commit*`
 * preconditions, so a commit can never accept what validation would reject.
 */

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

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

  return toValidation(violations);
};

export const validateShotArtifact = (
  shot: IAutoMovieShot,
  scene: IAutoMovieScene,
  motions: Record<string, IAutoMovieMcpMotion> | undefined,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(shot, "$input", "shot", violations))
    return toValidation(violations);
  validateNonEmptyId(shot.id, "$input.id", "shot id", violations);
  validateNonEmptyId(shot.scene, "$input.scene", "shot scene", violations);
  validateNonEmptyId(shot.camera, "$input.camera", "shot camera", violations);
  const sceneId = isRecord(scene) ? scene.id : undefined;
  if (shot.scene !== sceneId)
    pushViolation(
      violations,
      "type",
      "$input.scene",
      `shot scene "${shot.scene}" must match scene "${sceneId}"`,
      shot.scene,
    );
  const sceneCameras = asArray(isRecord(scene) ? scene.cameras : undefined);
  if (
    typeof shot.camera === "string" &&
    !sceneCameras.some(
      (camera) => isRecord(camera) && camera.id === shot.camera,
    )
  )
    pushViolation(
      violations,
      "type",
      "$input.camera",
      `shot camera "${shot.camera}" must reference a scene camera`,
      shot.camera,
    );
  validateRange(
    shot.duration,
    "$input.duration",
    0,
    Infinity,
    "shot duration",
    violations,
    false,
  );

  const nodeIds = new Set(
    asArray(isRecord(scene) ? scene.nodes : undefined)
      .filter(isRecord)
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string"),
  );
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
  validateUniqueBy(
    asArray(shot.performances).map((performance, index) => ({
      id: isRecord(performance) ? performance.node : undefined,
      path: `$input.performances[${index}].node`,
    })),
    "shot performance node",
    violations,
  );
  validateArrayArtifact(
    shot.performances,
    "$input.performances",
    "shot performances",
    violations,
  );
  asArray(shot.performances).forEach((performance, i) => {
    const path = `$input.performances[${i}]`;
    if (
      !validateObjectArtifact(performance, path, "shot performance", violations)
    )
      return;
    validateNonEmptyId(
      performance.node,
      `${path}.node`,
      "performance node",
      violations,
    );
    if (typeof performance.node === "string" && !nodeIds.has(performance.node))
      pushViolation(
        violations,
        "type",
        `${path}.node`,
        `performance node "${performance.node}" must reference a scene node`,
        performance.node,
      );
    validateRange(
      performance.startOffset,
      `${path}.startOffset`,
      0,
      shot.duration,
      "performance startOffset",
      violations,
    );
    if (performance.motion !== null) {
      validateNonEmptyId(
        performance.motion,
        `${path}.motion`,
        "performance motion",
        violations,
      );
      if (
        motionIds !== null &&
        typeof performance.motion === "string" &&
        !motionIds.has(performance.motion)
      )
        pushViolation(
          violations,
          "type",
          `${path}.motion`,
          `performance motion "${performance.motion}" must reference a compiled motion`,
          performance.motion,
        );
    }
  });

  if (shot.cameraMotion === undefined)
    pushViolation(
      violations,
      "type",
      "$input.cameraMotion",
      "shot cameraMotion must be null or a clip",
      shot.cameraMotion,
    );
  else if (shot.cameraMotion !== null)
    validateClipArtifact(shot.cameraMotion, "$input.cameraMotion", violations);
  validateUniqueIds(
    shot.objectMotions,
    "$input.objectMotions",
    "object motion clip id",
    violations,
  );
  asArray(shot.objectMotions).forEach((clip, i) => {
    validateClipArtifact(clip, `$input.objectMotions[${i}]`, violations);
  });

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
  });
  const shotsById = new Map(
    asArray(shots)
      .filter(isRecord)
      .filter((shot) => typeof shot.id === "string")
      .map((shot) => [shot.id as string, shot as unknown as IAutoMovieShot]),
  );

  validateArrayArtifact(
    sequence.shots,
    "$input.shots",
    "sequence shots",
    violations,
  );
  const entries = asArray(sequence.shots);
  entries.forEach((entry, i) => {
    const path = `$input.shots[${i}]`;
    if (!validateObjectArtifact(entry, path, "sequence entry", violations))
      return;
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
        Number.isFinite(transitionDuration) &&
        transitionDuration > Math.min(previous, current)
      )
        pushViolation(
          violations,
          "temporal",
          `${path}.transition.duration`,
          `transition duration must fit adjacent entries, but was ${transitionDuration}`,
          transitionDuration,
        );
    }
  });

  return toValidation(violations);
};

const validateClipArtifact = (
  clip: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(clip, path, "clip", violations)) return;
  validateNonEmptyId(clip.id, `${path}.id`, "clip id", violations);
  validateRange(
    clip.duration,
    `${path}.duration`,
    0,
    Infinity,
    "clip duration",
    violations,
    false,
  );
  validateArrayArtifact(
    clip.tracks,
    `${path}.tracks`,
    "clip tracks",
    violations,
  );
  validateUniqueBy(
    asArray(clip.tracks).map((track, index) => ({
      id: isRecord(track)
        ? `${String(isRecord(track.channel) ? track.channel.kind : undefined)}:${JSON.stringify(track.channel)}`
        : undefined,
      path: `${path}.tracks[${index}].channel`,
    })),
    "clip track channel",
    violations,
  );
  asArray(clip.tracks).forEach((track, i) => {
    const trackPath = `${path}.tracks[${i}]`;
    if (!validateObjectArtifact(track, trackPath, "clip track", violations))
      return;
    validateObjectArtifact(
      track.channel,
      `${trackPath}.channel`,
      "clip track channel",
      violations,
    );
    validateArrayArtifact(
      track.times,
      `${trackPath}.times`,
      "clip track times",
      violations,
    );
    validateArrayArtifact(
      track.values,
      `${trackPath}.values`,
      "clip track values",
      violations,
    );
    validateIncreasingTimes(
      track.times,
      clip.duration,
      `${trackPath}.times`,
      violations,
    );
    asArray(track.values).forEach((value, j) => {
      if (!Number.isFinite(value))
        pushViolation(
          violations,
          "range",
          `${trackPath}.values[${j}]`,
          `track value must be finite, but was ${value}`,
          value,
        );
    });
  });
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

const entryDuration = (
  entry: unknown,
  shot: IAutoMovieShot | undefined,
): number | null => {
  if (!isRecord(entry)) return null;
  if (shot === undefined) return null;
  if (isRecord(entry.trim) && typeof entry.trim.duration === "number")
    return entry.trim.duration;
  return shot.duration;
};

const validateIncreasingTimes = (
  times: unknown,
  duration: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!Array.isArray(times)) return;
  let previous = -Infinity;
  times.forEach((time, i) => {
    if (
      !Number.isFinite(time) ||
      typeof time !== "number" ||
      typeof duration !== "number" ||
      time < 0 ||
      time > duration
    )
      pushViolation(
        violations,
        "temporal",
        `${path}[${i}]`,
        `track time must be finite and within [0, ${duration}], but was ${time}`,
        time,
      );
    if (Number.isFinite(time) && time <= previous)
      pushViolation(
        violations,
        "temporal",
        `${path}[${i}]`,
        `track times must strictly increase; ${time} is not greater than ${previous}`,
        time,
      );
    if (Number.isFinite(time)) previous = time;
  });
};
