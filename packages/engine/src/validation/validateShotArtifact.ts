import {
  IAutoMovieConstraintViolation,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  LIGHT_CHANNEL_PROPERTIES,
  parseLightPointer,
} from "../resolve/lightChannel";
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
import {
  IAutoMovieNodeChannel,
  NODE_CHANNEL_PATHS,
  clipLoopFault,
  clipTrackShapeFaults,
} from "./clipTrackShape";
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
  appendLightMotionsArtifact(
    shot.lightMotions,
    "$input.lightMotions",
    stagedLightKinds(scene),
    violations,
  );

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
 * One clip's structural contract, to the depth every consumer dereferences it.
 *
 * Exported because the shot artifact is not its only gate: the project store
 * validates stored clips on READ, and a gate that exists to catch a corrupted
 * file must check what its consumers dereference (#1324).
 *
 * The keyframe payload comes from the contract `sampleClip` itself reads
 * ({@link clipTrackShapeFaults}), rather than from a second hand-maintained copy
 * of it. Holding the rule twice is what let this gate learn ONE of the
 * sampler's checks and none of the other seven, so a clip with an uneven value
 * stride, an empty keyframe list, a wrong value width, an unsupported
 * interpolation, a non-triplet `cubicspline` stride, a non-boolean `loop`, or
 * an unknown node channel path validated clean here and threw out of the engine
 * when something played it (#1353).
 *
 * The clip's own `duration` stays stricter here than the sampler's rule: a
 * committed clip must last longer than zero seconds, while the sampler
 * tolerates a zero-length clip by normalizing every query to its start. A gate
 * stricter than its consumer refuses more, never less, so it cannot let a throw
 * escape.
 */
export const validateClipArtifact = (
  clip: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
  /**
   * Which channels this clip's tracks may address. Defaults to the node gate
   * every transform clip (`cameraMotion`, `objectMotions`, a coverage take, a
   * stored slice) is held to; `lightMotions` passes its own.
   */
  channelGate: IAutoMovieClipChannelGate = validateHonorableChannel,
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
  const loop = clipLoopFault(clip.loop);
  if (loop !== null)
    pushViolation(
      violations,
      loop.kind,
      `${path}.${loop.field}`,
      `clip ${loop.message}`,
      loop.value,
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
    const channel: unknown = track.channel;
    if (
      validateObjectArtifact(
        channel,
        `${trackPath}.channel`,
        "clip track channel",
        violations,
      )
    )
      channelGate(channel, `${trackPath}.channel`, violations);
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
    for (const fault of clipTrackShapeFaults(track, clip.duration))
      pushViolation(
        violations,
        fault.kind,
        `${trackPath}.${fault.field}`,
        `track ${fault.message}`,
        fault.value,
      );
  });
};

/**
 * The per-field rule for which channels one clip's tracks may address. A shot
 * field admits exactly the targets its own applier writes, so the gate is a
 * parameter of the field rather than one fixed rule for every clip.
 */
type IAutoMovieClipChannelGate = (
  channel: Record<string, unknown>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
) => void;

/**
 * A TRANSFORM clip's track must address a channel the pipeline can HONOR
 * (#1339).
 *
 * `IAutoMovieChannel` has two arms, and only one of them is applied when a shot
 * plays a transform clip. `resolveFrame` and the viewer's `applyObjectMotion`
 * each write node channels onto the node they name and `continue` past
 * everything else, so a pointer track (`/materials/2/baseColor`,
 * `/cameras/0/fovY`, a rig DOF) validated clean, persisted to
 * `shots/<beat>.json`, was read back unchanged by `getShot`, and then silently
 * did nothing: the committed artifact said the candle dims and the film never
 * dimmed it.
 *
 * A validator that passes an instruction no consumer executes is a false green,
 * and the guide corpus tells an agent to trust exactly this verdict. So the
 * artifact contract refuses what the pipeline cannot perform, naming the
 * supported set, rather than accepting and discarding it.
 *
 * The set widens where an applier lands, and only there: `lightMotions` carries
 * light pointers because {@link resolveShotLighting} writes them (#1348), and
 * this gate is unchanged because `applyObjectMotion` still does not. Widening
 * it here without an applier would restore the exact false green #1339 closed.
 *
 * The gate is scoped to CLIP TRACKS on purpose. The other user of
 * `IAutoMovieChannel` is the driver graph (a prop profile's `source`/`output`,
 * `IAutoMovieChannelLimit.channel`), where `resolve/drivers` does read pointer
 * keys out of the sampled map. Those stay untouched.
 */
const validateHonorableChannel: IAutoMovieClipChannelGate = (
  channel,
  path,
  violations,
): void => {
  if (channel.kind !== "node") {
    pushViolation(
      violations,
      "type",
      `${path}.kind`,
      `clip track channel kind must be "node"; the pipeline resolves node channels (translation/rotation/scale/weights) onto scene nodes and honors no other target on a transform clip (a light change belongs in the shot's lightMotions), but was ${JSON.stringify(channel.kind)}`,
      channel.kind,
    );
    return;
  }
  // The node arm's own address. `channelKey` builds `node:<id>:<path>` from the
  // same set and throws for anything outside it, so a track naming a property
  // like `opacity` used to validate clean here and take the sampler's throw
  // instead of a violation (#1353): the pointer arm was closed and the node
  // arm's unknown paths were left open, which is the same false green one
  // discriminator over.
  if (!NODE_CHANNEL_PATHS.has(channel.path as IAutoMovieNodeChannel["path"]))
    pushViolation(
      violations,
      "type",
      `${path}.path`,
      `clip track channel path must be one of ${[...NODE_CHANNEL_PATHS].join(", ")}; the pipeline writes no other property of a node, but was ${JSON.stringify(channel.path)}`,
      channel.path,
    );
};

/**
 * A LIGHT clip's track must address one staged light's animatable property, and
 * exactly the ones {@link resolveShotLighting} writes (#1348).
 *
 * Admission is read out of `LIGHT_CHANNEL_PROPERTIES`, the same table the
 * applier folds its sampled values through. There is no second list to keep in
 * step: a property the table does not carry is refused here and unreachable
 * there, and a property added to the table becomes admissible and applied in
 * one edit. That is the mechanical form of the rule two of this campaign's
 * defects sit on either side of: a validated axis with no applier (#1339), and
 * an applier that silently ignores part of its input (#1349).
 *
 * `stagedLightKinds` is the scene's light id → `type` index when the caller has
 * a scene to cross-reference (the submitted-artifact path) and `null` when it
 * does not (the stored-slice path, which reads one file with no scene beside
 * it). Without it the pointer grammar and value type are still gated; only the
 * "does this light exist, and does its kind carry this" pair defers.
 */
export const lightClipChannelGate =
  (
    stagedLightKinds: ReadonlyMap<string, unknown> | null,
  ): IAutoMovieClipChannelGate =>
  (channel, path, violations): void => {
    if (channel.kind !== "pointer") {
      pushViolation(
        violations,
        "type",
        `${path}.kind`,
        `light clip track channel kind must be "pointer" addressing /lights/<light id>/<property>, but was ${JSON.stringify(channel.kind)}`,
        channel.kind,
      );
      return;
    }
    const target = parseLightPointer(channel.pointer);
    if (target === null) {
      pushViolation(
        violations,
        "type",
        `${path}.pointer`,
        `light clip track pointer must be /lights/<light id>/<property> with property one of ${[...Object.keys(LIGHT_CHANNEL_PROPERTIES)].join(", ")}, but was ${JSON.stringify(channel.pointer)}`,
        channel.pointer,
      );
      return;
    }
    const property = LIGHT_CHANNEL_PROPERTIES[target.property];
    if (channel.valueType !== property.valueType)
      pushViolation(
        violations,
        "type",
        `${path}.valueType`,
        `light clip track "${target.property}" resolves to ${property.valueType}, but was ${JSON.stringify(channel.valueType)}`,
        channel.valueType,
      );
    if (stagedLightKinds === null) return;
    const kind = stagedLightKinds.get(target.light);
    if (kind === undefined)
      pushViolation(
        violations,
        "type",
        `${path}.pointer`,
        `light clip track must address a staged scene light, but "${target.light}" is not one`,
        channel.pointer,
      );
    else if (!property.carries(kind))
      pushViolation(
        violations,
        "type",
        `${path}.pointer`,
        `light clip track addresses "${target.property}", which a ${String(kind)} light does not carry`,
        channel.pointer,
      );
  };

/**
 * The scene's light id → `type` index, keyed by the only thing a pointer can
 * name. A staged entry that is not an object, or whose id is not a string, is
 * not addressable at all and is left out; that scene is malformed, and
 * `validateSceneArtifact` is the gate that says so.
 */
const stagedLightKinds = (scene: unknown): ReadonlyMap<string, unknown> => {
  const index = new Map<string, unknown>();
  for (const light of asArray(isRecord(scene) ? scene.lights : undefined))
    if (isRecord(light) && typeof light.id === "string")
      index.set(light.id, light.type);
  return index;
};

/**
 * The shot's `lightMotions`, gated the way every other optional shot field is:
 * absent stays valid ("absent means legacy"), a present value is inspected in
 * full.
 *
 * Beyond each clip's own shape, one rule is the field's alone: no two tracks in
 * the whole field may address the same light property. Within one clip
 * `validateClipArtifact` already refuses a duplicate channel, but two CLIPS
 * both dimming the same candle would resolve last-writer-wins, which is a
 * deterministic answer to a question the artifact never meant to ask. Refusing
 * it keeps the committed film's lighting single-valued at every instant.
 */
export const appendLightMotionsArtifact = (
  lightMotions: unknown,
  path: string,
  /**
   * The scene's light id → kind index, or `null` with no scene to check
   * against.
   */
  stagedLights: ReadonlyMap<string, unknown> | null,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (lightMotions === undefined) return;
  if (
    !validateArrayArtifact(lightMotions, path, "shot lightMotions", violations)
  )
    return;
  validateUniqueIds(lightMotions, path, "light motion clip id", violations);
  const gate = lightClipChannelGate(stagedLights);
  const addressed: { id: unknown; path: string }[] = [];
  lightMotions.forEach((clip, i) => {
    const clipPath = `${path}[${i}]`;
    validateClipArtifact(clip, clipPath, violations, gate);
    asArray(isRecord(clip) ? clip.tracks : undefined).forEach((track, j) => {
      const channel: unknown = isRecord(track) ? track.channel : undefined;
      const target = isRecord(channel)
        ? parseLightPointer(channel.pointer)
        : null;
      addressed.push({
        id: target === null ? undefined : `${target.light}/${target.property}`,
        path: `${clipPath}.tracks[${j}].channel`,
      });
    });
  });
  validateUniqueBy(addressed, "light motion channel", violations);
};

