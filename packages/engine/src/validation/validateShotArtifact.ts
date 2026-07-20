import {
  IAutoMovieConstraintViolation,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  asArray,
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateRange,
  validateUniqueBy,
  validateUniqueIds,
  validateVectorArtifact,
} from "./artifactShape";
import { toValidation } from "./violation";

/**
 * The shot artifact's structural contract, owned by the engine that produces
 * it.
 *
 * It used to live only beside the MCP commit gate, so `performShot` could emit
 * a shot no consumer would accept and report success: the same failure recurred
 * five times (#1224, #1308, #1314, #1316, #1318), each fixed by teaching the
 * producer one more field. The rules now have a single home, on the side that
 * both the producer and every consumer can reach (#1320).
 *
 * What stays with the host: whether a slice is committable, whether a resident
 * registry supplies the referenced clips, and how a project addresses its
 * files. Those are questions about a deployment, not about the artifact.
 *
 * @author Samchon
 */

export const validateShotArtifact = (
  shot: IAutoMovieShot,
  scene: IAutoMovieScene,
  /**
   * Ids the shot's `performances[].motion` may reference, or `null` to skip
   * that cross-check. The caller resolves the registry: the engine knows what a
   * valid reference IS, not where a host keeps its clips.
   */
  motionIds: ReadonlySet<string> | null,
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

  appendShotMetadataArtifact(
    shot,
    "$input",
    new Set(
      sceneCameras
        .filter(isRecord)
        .map((camera) => camera.id)
        .filter((id): id is string => typeof id === "string"),
    ),
    violations,
  );

  return toValidation(violations);
};

/** The closed event-kind union, gated the way the engine's compilers emit it. */
const EVENT_KINDS = new Set([
  "contact",
  "hit",
  "grab",
  "release",
  "attach",
  "detach",
  "fall",
]);

/**
 * The slack the shot-local event clock carries at its upper bound, matching
 * `performShot`'s own landing comparison so the two cannot disagree about an
 * event that lands exactly on the shot end.
 */
const EVENT_TIME_EPSILON = 1e-9;

/** The closed event-source union. */
const EVENT_SOURCES = new Set([
  "collisionSolver",
  "scriptedCue",
  "sampledProximity",
  "impactOutput",
]);

/** The closed framing union, the same set `performShot` gates a frame action by. */
const CAMERA_FRAMINGS = new Set(["wide", "full", "medium", "close"]);

/** The closed move union, the same set `performShot` gates a frame action by. */
const CAMERA_MOVES = new Set(["static", "follow", "orbit", "push-in", "whip"]);

/**
 * The three shot fields the validators used to pass ungated: `events`,
 * `cameraIntent`, and `coverage`.
 *
 * A field the engine emits and a consumer dereferences is part of the artifact
 * contract, not decoration: `playbackEvents` and `reviewVisualRead` iterate
 * `shot.events` (a non-iterable value throws with no path), and a render or
 * diffusion host reads `cameraIntent` and `coverage` as the structural guide
 * metadata #1187 promised it. All three are optional on {@link IAutoMovieShot}
 * and documented as "absent means legacy", so absence stays valid; only a
 * PRESENT value is inspected.
 *
 * `sceneCameras` is the scene's camera-id set when the caller has a scene to
 * cross-reference (the submitted-artifact path) and `null` when it does not
 * (the stored-slice path, which reads one file with no scene beside it).
 */
export const appendShotMetadataArtifact = (
  /**
   * Structural, not `IAutoMovieShot`, so both callers pass their own value
   * without a cast: the submitted artifact arrives already narrowed to a
   * record, the stored slice arrives as the typed shot.
   */
  shot: {
    duration?: unknown;
    camera?: unknown;
    events?: unknown;
    cameraIntent?: unknown;
    coverage?: unknown;
  },
  path: string,
  sceneCameras: ReadonlySet<string> | null,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const duration = typeof shot.duration === "number" ? shot.duration : Infinity;
  if (shot.events !== undefined)
    appendShotEventsArtifact(
      shot.events,
      `${path}.events`,
      duration,
      violations,
    );
  if (shot.cameraIntent !== undefined)
    appendCameraIntentArtifact(
      shot.cameraIntent,
      `${path}.cameraIntent`,
      duration,
      violations,
    );
  if (shot.coverage !== undefined)
    appendShotCoverageArtifact(
      shot.coverage,
      `${path}.coverage`,
      duration,
      shot.camera,
      sceneCameras,
      violations,
    );
};

const appendShotEventsArtifact = (
  events: unknown,
  path: string,
  duration: number,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(events, path, "shot events", violations)) return;
  events.forEach((event, i) => {
    const eventPath = `${path}[${i}]`;
    if (!validateObjectArtifact(event, eventPath, "shot event", violations))
      return;
    validateNonEmptyId(
      event.id,
      `${eventPath}.id`,
      "shot event id",
      violations,
    );
    if (typeof event.kind !== "string" || !EVENT_KINDS.has(event.kind))
      pushViolation(
        violations,
        "type",
        `${eventPath}.kind`,
        `shot event kind must be one of ${[...EVENT_KINDS].join(", ")}, but was "${String(event.kind)}"`,
        event.kind,
      );
    if (typeof event.source !== "string" || !EVENT_SOURCES.has(event.source))
      pushViolation(
        violations,
        "type",
        `${eventPath}.source`,
        `shot event source must be one of ${[...EVENT_SOURCES].join(", ")}, but was "${String(event.source)}"`,
        event.source,
      );
    // The shot-local clock: `playbackEvents` maps this onto the output timeline,
    // so a time outside the shot lands somewhere no entry plays. The upper bound
    // carries the SAME slack `performShot`'s landing gate allows (it refuses a
    // hit only past `duration + 1e-9`), or a launch that lands exactly on the
    // shot end would produce a shot this validator refuses: validator/engine
    // drift in the direction #1097 warned about.
    const time = event.time;
    if (
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      time < 0 ||
      time > duration + EVENT_TIME_EPSILON
    )
      pushViolation(
        violations,
        "temporal",
        `${eventPath}.time`,
        `shot event time must be finite and within [0, ${duration}] (the shot), but was ${String(time)}`,
        time,
      );
    for (const field of ["actor", "target", "object", "reaction"] as const)
      if (event[field] !== null)
        validateNonEmptyId(
          event[field],
          `${eventPath}.${field}`,
          `shot event ${field}`,
          violations,
        );
    // A non-finite point makes `reviewVisualRead`'s contact distance NaN, and
    // `NaN > contactRadius` is false, so a genuine miss reads as a connect.
    if (event.point !== null)
      validateVectorArtifact(
        event.point,
        `${eventPath}.point`,
        "shot event point",
        violations,
      );
    if (event.actionIndex !== null && !Number.isInteger(event.actionIndex))
      pushViolation(
        violations,
        "range",
        `${eventPath}.actionIndex`,
        `shot event actionIndex must be null or an integer, but was ${String(event.actionIndex)}`,
        event.actionIndex,
      );
  });
};

const appendCameraIntentArtifact = (
  intents: unknown,
  path: string,
  duration: number,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(intents, path, "camera intent spans", violations))
    return;
  intents.forEach((intent, i) => {
    const intentPath = `${path}[${i}]`;
    if (
      !validateObjectArtifact(intent, intentPath, "camera intent", violations)
    )
      return;
    validateRange(
      intent.start,
      `${intentPath}.start`,
      0,
      duration,
      "camera intent start",
      violations,
    );
    if (
      typeof intent.framing !== "string" ||
      !CAMERA_FRAMINGS.has(intent.framing)
    )
      pushViolation(
        violations,
        "type",
        `${intentPath}.framing`,
        `camera intent framing must be one of ${[...CAMERA_FRAMINGS].join(", ")}, but was "${String(intent.framing)}"`,
        intent.framing,
      );
    if (typeof intent.move !== "string" || !CAMERA_MOVES.has(intent.move))
      pushViolation(
        violations,
        "type",
        `${intentPath}.move`,
        `camera intent move must be one of ${[...CAMERA_MOVES].join(", ")}, but was "${String(intent.move)}"`,
        intent.move,
      );
    if (intent.focus !== null)
      validateVectorArtifact(
        intent.focus,
        `${intentPath}.focus`,
        "camera intent focus",
        violations,
      );
    // The input gate refuses a focal length <= 0 mm; the artifact must agree.
    if (intent.focalLength !== null)
      validateRange(
        intent.focalLength,
        `${intentPath}.focalLength`,
        0,
        Infinity,
        "camera intent focal length",
        violations,
        false,
      );
  });
};

const appendShotCoverageArtifact = (
  coverage: unknown,
  path: string,
  duration: number,
  heroCamera: unknown,
  sceneCameras: ReadonlySet<string> | null,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(coverage, path, "shot coverage", violations))
    return;
  const seen = new Map<string, number>();
  coverage.forEach((take, i) => {
    const takePath = `${path}[${i}]`;
    if (!validateObjectArtifact(take, takePath, "coverage take", violations))
      return;
    validateNonEmptyId(
      take.camera,
      `${takePath}.camera`,
      "coverage camera",
      violations,
    );
    if (typeof take.camera === "string") {
      if (sceneCameras !== null && !sceneCameras.has(take.camera))
        pushViolation(
          violations,
          "type",
          `${takePath}.camera`,
          `coverage camera "${take.camera}" must reference a scene camera`,
          take.camera,
        );
      // The same rule the engine enforces when compiling the take: coverage
      // plays ANOTHER angle, so the hero camera can never also cover the beat,
      // and one camera never covers it twice.
      if (take.camera === heroCamera)
        pushViolation(
          violations,
          "type",
          `${takePath}.camera`,
          `coverage plays another angle of the beat, but "${take.camera}" is already this shot's live camera`,
          take.camera,
        );
      const first = seen.get(take.camera);
      if (first !== undefined)
        pushViolation(
          violations,
          "type",
          `${takePath}.camera`,
          `coverage camera "${take.camera}" is duplicated; first declared at ${path}[${first}].camera`,
          take.camera,
        );
      else seen.set(take.camera, i);
    }
    if (take.cameraMotion === undefined)
      pushViolation(
        violations,
        "type",
        `${takePath}.cameraMotion`,
        "coverage cameraMotion must be null or a clip",
        take.cameraMotion,
      );
    else if (take.cameraMotion !== null)
      validateClipArtifact(
        take.cameraMotion,
        `${takePath}.cameraMotion`,
        violations,
      );
    appendCameraIntentArtifact(
      take.cameraIntent,
      `${takePath}.cameraIntent`,
      duration,
      violations,
    );
  });
};

/**
 * One clip's structural contract: track shape, strictly increasing times inside
 * the clip's duration, and finite values. Exported because the shot artifact is
 * not its only gate: the project store validates stored clips on READ, and a
 * gate that exists to catch a corrupted file must check what its consumers
 * dereference (#1324). `sampleClip` assumes the increasing times this pins.
 */
export const validateClipArtifact = (
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
