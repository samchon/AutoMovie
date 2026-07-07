import { toValidation } from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";

import { IAutoMovieMcpGeometryModel, IAutoMovieMcpMotion } from "../dto";
import {
  pushViolation,
  validateColorArtifact,
  validateNonEmptyId,
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

export const validateSceneArtifact = (
  scene: IAutoMovieScene,
  models: IAutoMovieMcpGeometryModel[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyId(scene.id, "$input.id", "scene id", violations);
  validateUniqueIds(scene.nodes, "$input.nodes", "scene node id", violations);
  validateUniqueIds(scene.cameras, "$input.cameras", "camera id", violations);
  validateUniqueIds(scene.lights, "$input.lights", "light id", violations);
  validateUniqueIds(models, "$models", "model id", violations);

  const modelIds = new Set(models.map((model) => model.id));
  scene.nodes.forEach((node, i) => {
    const path = `$input.nodes[${i}]`;
    validateNonEmptyId(node.id, `${path}.id`, "scene node id", violations);
    validateNonEmptyId(
      node.model,
      `${path}.model`,
      "scene node model",
      violations,
    );
    if (!modelIds.has(node.model))
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

  scene.cameras.forEach((camera, i) => {
    const path = `$input.cameras[${i}]`;
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
    if (!Number.isFinite(camera.far) || camera.far <= camera.near)
      pushViolation(
        violations,
        "range",
        `${path}.far`,
        `camera far must be finite and greater than near (${camera.near}), but was ${camera.far}`,
        camera.far,
      );
  });

  scene.lights.forEach((light, i) => {
    const path = `$input.lights[${i}]`;
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
  validateNonEmptyId(shot.id, "$input.id", "shot id", violations);
  if (shot.scene !== scene.id)
    pushViolation(
      violations,
      "type",
      "$input.scene",
      `shot scene "${shot.scene}" must match scene "${scene.id}"`,
      shot.scene,
    );
  if (!scene.cameras.some((camera) => camera.id === shot.camera))
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

  const nodeIds = new Set(scene.nodes.map((node) => node.id));
  const motionIds =
    motions === undefined
      ? null
      : new Set(Object.values(motions).map((motion) => motion.id));
  validateUniqueBy(
    shot.performances.map((performance, index) => ({
      id: performance.node,
      path: `$input.performances[${index}].node`,
    })),
    "shot performance node",
    violations,
  );
  shot.performances.forEach((performance, i) => {
    const path = `$input.performances[${i}]`;
    validateNonEmptyId(
      performance.node,
      `${path}.node`,
      "performance node",
      violations,
    );
    if (!nodeIds.has(performance.node))
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
      if (motionIds !== null && !motionIds.has(performance.motion))
        pushViolation(
          violations,
          "type",
          `${path}.motion`,
          `performance motion "${performance.motion}" must reference a compiled motion`,
          performance.motion,
        );
    }
  });

  if (shot.cameraMotion !== null)
    validateClipArtifact(shot.cameraMotion, "$input.cameraMotion", violations);
  validateUniqueIds(
    shot.objectMotions,
    "$input.objectMotions",
    "object motion clip id",
    violations,
  );
  shot.objectMotions.forEach((clip, i) =>
    validateClipArtifact(clip, `$input.objectMotions[${i}]`, violations),
  );

  return toValidation(violations);
};

export const validateSequenceArtifact = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
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
  const shotsById = new Map(shots.map((shot) => [shot.id, shot]));

  sequence.shots.forEach((entry, i) => {
    const path = `$input.shots[${i}]`;
    validateNonEmptyId(entry.shot, `${path}.shot`, "sequence shot", violations);
    const shot = shotsById.get(entry.shot);
    if (shot === undefined)
      pushViolation(
        violations,
        "type",
        `${path}.shot`,
        `sequence shot "${entry.shot}" must reference an available shot`,
        entry.shot,
      );
    if (entry.trim !== null)
      validateTrim(
        entry.trim,
        shot?.duration ?? Infinity,
        `${path}.trim`,
        violations,
      );
    if (entry.transition !== null) {
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
      const previousEntry = sequence.shots[i - 1];
      const previous =
        previousEntry === undefined
          ? null
          : entryDuration(previousEntry, shotsById.get(previousEntry.shot));
      if (
        previous !== null &&
        current !== null &&
        entry.transition.duration > Math.min(previous, current)
      )
        pushViolation(
          violations,
          "temporal",
          `${path}.transition.duration`,
          `transition duration must fit adjacent entries, but was ${entry.transition.duration}`,
          entry.transition.duration,
        );
    }
  });

  return toValidation(violations);
};

const validateClipArtifact = (
  clip: IAutoMovieClip,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
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
  validateUniqueBy(
    clip.tracks.map((track, index) => ({
      id: `${track.channel.kind}:${JSON.stringify(track.channel)}`,
      path: `${path}.tracks[${index}].channel`,
    })),
    "clip track channel",
    violations,
  );
  clip.tracks.forEach((track, i) => {
    const trackPath = `${path}.tracks[${i}]`;
    validateIncreasingTimes(
      track.times,
      clip.duration,
      `${trackPath}.times`,
      violations,
    );
    track.values.forEach((value, j) => {
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
  trim: NonNullable<IAutoMovieSequence["shots"][number]["trim"]>,
  shotDuration: number,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
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
  if (
    Number.isFinite(shotDuration) &&
    Number.isFinite(trim.start) &&
    Number.isFinite(trim.duration) &&
    trim.start + trim.duration > shotDuration
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
  transition: NonNullable<IAutoMovieSequence["shots"][number]["transition"]>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void =>
  validateRange(
    transition.duration,
    `${path}.duration`,
    0,
    Infinity,
    "transition duration",
    violations,
    false,
  );

const entryDuration = (
  entry: IAutoMovieSequence["shots"][number],
  shot: IAutoMovieShot | undefined,
): number | null => {
  if (shot === undefined) return null;
  return entry.trim?.duration ?? shot.duration;
};

const validateIncreasingTimes = (
  times: number[],
  duration: number,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  let previous = -Infinity;
  times.forEach((time, i) => {
    if (!Number.isFinite(time) || time < 0 || time > duration)
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
