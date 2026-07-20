import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
  IAutoMovieBlockingApplication,
  IAutoMovieCameraAction,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMovieQuaternion,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";
import { actionRegion } from "../perform/actionRegion";
import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
} from "../perform/compilePerformance";
import { resolveTargetPoint } from "../perform/resolveTargetPoint";
import { scenePlacements } from "../perform/scenePlacements";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { validateMotion } from "../validation/validateMotion";
import { ViolationCollector } from "../validation/violation";
import {
  DEFAULT_SUBJECT_HEIGHT,
  IAutoMovieCameraFrameEntry,
  compileCameraMove,
  computeRestHeight,
} from "./cameraMove";
import { compileLaunch } from "./compileLaunch";
import { coupleObjects } from "./coupleObjects";
import { IAutoMovieStagedSet } from "./stageScene";

/**
 * A node's animated **world** position over shot time: its staged `base` plus
 * the node-local root displacement of `motion` at that instant, rotated into
 * the world by the node's staged `facing`. The read shared by a `follow` camera
 * tracking a walking actor and a `launch` leading a moving target, one place,
 * one convention (the root is node-local; the renderer applies it under the
 * same facing).
 */
const animatedBaseAt =
  (
    base: IAutoMovieVector3,
    facing: IAutoMovieQuaternion,
    motion: IAutoMovieMotion,
  ) =>
  (seconds: number): IAutoMovieVector3 =>
    Vector3.add(
      base,
      Quaternion.rotateVector(
        facing,
        sampleMotion(motion, seconds).pose.root?.translation ?? {
          x: 0,
          y: 0,
          z: 0,
        },
      ),
    );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const targetKindName = (target: unknown): string =>
  isRecord(target) && typeof target.kind === "string"
    ? target.kind
    : "malformed";

/**
 * What a positional target may be, stated once so every verb's refusal teaches
 * the same vocabulary. Cameras belong in the list because
 * {@link scenePlacements} resolves them (#1294).
 */
const POSITIONAL_TARGET_SHAPE =
  "a node/point/group, whose ids name placed actors, set pieces, or cameras";

/**
 * Why a positional target did not resolve to a world point, phrased as the
 * clause after "but".
 *
 * The discriminator is the fault only for a relative or unknown kind. A `node`
 * or `group` target names a legal kind and an id that is not placed, so echoing
 * the kind made one sentence list a node target as valid and reject it at the
 * same time, leaving the correction round nothing it could act on (#1294). Name
 * the id instead: it is the only thing the author can fix.
 */
const positionalTargetFault = (target: IAutoMovieActionTarget): string => {
  if (target.kind === "node")
    return `"${String(target.node)}" is not placed in the staged scene`;
  if (target.kind === "group")
    return target.nodes.length === 0
      ? "its group names no members"
      : `none of its group members are placed in the staged scene: ${target.nodes
          .map((node) => `"${String(node)}"`)
          .join(", ")}`;
  if (target.kind === "point")
    return "a point target carries no point to resolve";
  if (target.kind === "direction" || target.kind === "offscreen")
    return `a target of kind "${target.kind}" is relative (a heading or a frame edge), so it names no place`;
  return `"${targetKindName(target)}" is not a positional target kind`;
};

const actionActors = (action: IAutoMovieActionCall): string[] =>
  typeof action.actor === "string"
    ? [action.actor]
    : Array.isArray(action.actor)
      ? action.actor
      : [];

const EVENT_KIND_ORDER: Record<IAutoMovieInteractionEvent["kind"], number> = {
  contact: 0,
  hit: 1,
  fall: 2,
  grab: 3,
  attach: 4,
  detach: 5,
  release: 6,
};

const CAMERA_FRAMINGS = new Set<IAutoMovieCameraAction["framing"]>([
  "wide",
  "full",
  "medium",
  "close",
]);

const CAMERA_MOVES = new Set<IAutoMovieCameraAction["move"]>([
  "static",
  "follow",
  "orbit",
  "push-in",
  "whip",
]);

const orderEvents = (
  events: readonly IAutoMovieInteractionEvent[],
): IAutoMovieInteractionEvent[] =>
  [...events].sort(
    (a, b) =>
      a.time - b.time ||
      EVENT_KIND_ORDER[a.kind] - EVENT_KIND_ORDER[b.kind] ||
      compareCodeUnits(a.id, b.id),
  );

/**
 * A performed shot: the assembled {@link IAutoMovieShot} plus the dense motion
 * clips the compiler synthesised for it. The clips travel alongside the shot
 * because the shot references them by id, the host registers them wherever its
 * clip store lives.
 *
 * @author Samchon
 */
export type IAutoMoviePerformedShot =
  | IAutoMoviePerformedShot.ISuccess
  | IAutoMoviePerformedShot.IFailure;
export namespace IAutoMoviePerformedShot {
  /** The performance compiled and every clip passed validation. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The shot, ready for the cut. */
    shot: IAutoMovieShot;

    /** The synthesised per-actor clips, keyed by scene-node id. */
    motions: Record<string, IAutoMovieMotion>;
  }

  /** The action list contradicted the stage, or a compiled clip broke ROM. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The PERFORMANCE consumer, fold one beat's action calls into an
 * {@link IAutoMovieShot} through {@link compilePerformance}, gating both sides of
 * the seam: the calls must reference the staged world (a beat the script
 * planned, actors the stage placed), and the clips the synthesizer fattened
 * them into must survive `validateMotion` against each actor's skeleton. The
 * revise pass wins by construction: `revise.final ?? draft` is the list that
 * performs.
 *
 * Camera `frame` actions elect the live camera and author its move: the first
 * one names the shot's camera (staging aimed it already), rival `frame` calls
 * on a second camera are a violation, one take, one live camera, and the
 * elected camera's frame actions compile into `cameraMotion` through
 * {@link compileCameraMove}'s framing grammar. Frame subjects must resolve to a
 * point (node/point/group), and same-camera moves must not overlap in time. A
 * shot with no `frame` call falls back to the scene's first camera, locked off
 * (`cameraMotion: null`); a scene with no cameras at all cannot be framed and
 * fails.
 *
 * Positional targets (`lookAt`, `reach`, a `point`/`strike` gesture aim, a
 * `launch` aim, a frame subject or focus) resolve against every staged
 * placement, {@link scenePlacements}, **cameras included**: an actor may be
 * directed to look down the lens, which is ordinary film grammar (#1294). That
 * does not loosen the camera-as-actor rule, a camera still performs nothing but
 * `frame`; it only makes a camera a place one can point at. A target that does
 * not resolve names the id (or the relative kind) that failed, never the
 * discriminator of a kind that was legal all along.
 *
 * `launch` actions are compiled through {@link compileLaunch}: the projectile (a
 * staged scene node) gets its baked flight as a shot `objectMotion`, and, for a
 * node aim carrying `onHit`, the struck actor's recoil is folded into the
 * action list at the **engine-computed** contact, so it rides the same
 * synthesis and ROM gate as an authored `react`. The projectile must be staged,
 * the aim must resolve to a point, and the shot must reach the target at the
 * given speed, each an input violation otherwise.
 *
 * `attachTo` actions are compiled through {@link compileAttach} once the parent
 * pose is known: the coupled child (a prop, not a rig) gets a shot
 * `objectMotion` that rides the parent's bone in scene space each frame. The
 * parent must be a staged, rigged node carrying the named bone, each an input
 * violation otherwise.
 *
 * Staged `mounts` (the persistent couplings staging declared, #674) descend
 * through the SAME {@link compileAttach} baker, spanning the whole shot, so a
 * rider rides every beat without re-issuing `attachTo`. An explicit `attachTo`
 * for the same child this beat overrides its mount; a mount emits no
 * grab/attach/detach/release events (it is standing scene state, not a per-shot
 * pickup). A mount onto a rig-less parent or an absent bone is a violation.
 *
 * @param props.skeleton Rig lookup for ROM validation; return null for a node
 *   that has no skeleton (its clip skips ROM).
 * @param props.restFrames Optional per-node clinical rest-frame lookup. Supply
 *   the same frame table the renderer/player uses so `attachTo` objectMotions
 *   ride the visible posed bone, not raw rig-space FK.
 */
export const performShot = (props: {
  script: IAutoMovieScriptApplication.IWrite;
  staged: IAutoMovieStagedSet.ISuccess;
  performance: IAutoMoviePerformanceApplication.IWrite;
  synthesize: IAutoMovieActionSynthesizer;
  skeleton: (node: string) => IAutoMovieSkeleton | null;
  restFrames?: (
    node: string,
  ) => Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>> | undefined;
  /**
   * The gait names each actor's context supplies, for validating `locomote`
   * actions: a `locomote` naming a gait this lookup does not list for the actor
   * is a `type` violation, so the reference synthesiser never silently drops it
   * (an unresolved gait produces no motion). Omit, or return `undefined` for a
   * node, to skip the check (byte-identical to before: no gait gate).
   */
  gaits?: (node: string) => readonly string[] | undefined;
  /**
   * The beat's validated blocking (from `blockBeat`), when the pipeline runs
   * the full stage ladder. Supplying it arms the coherence gates between intent
   * and realization: matching beat and duration, every timing anchor covered by
   * an action of its actor, and the camera intent honoured.
   */
  blocking?: IAutoMovieBlockingApplication.IWrite;
}): IAutoMoviePerformedShot => {
  const {
    script,
    staged,
    performance,
    synthesize,
    skeleton,
    restFrames,
    gaits,
    blocking,
  } = props;
  const out = new ViolationCollector();
  const beatById = new Map<
    string,
    {
      beat: IAutoMovieScriptApplication.IWrite["beats"][number];
      index: number;
    }
  >();
  script.beats.forEach((beat, index) => {
    const existing = beatById.get(beat.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `$script.beats[${index}].id`,
        `script beat id "${beat.id}" is duplicated; first declared at $script.beats[${existing.index}].id`,
        beat.id,
      );
      return;
    }
    beatById.set(beat.id, { beat, index });
  });

  const validateNonEmptyId = (
    id: unknown,
    path: string,
    label: string,
  ): void => {
    if (typeof id !== "string") {
      out.push("type", path, `${label} must be a string`, id);
      return;
    }
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  const validateTargetNodeIds = (
    target: unknown,
    path: string,
    label: string,
  ): target is IAutoMovieActionTarget => {
    if (!isRecord(target)) {
      out.push("type", path, `${label} must be an action target`, target);
      return false;
    }
    if (target.kind === "node") {
      validateNonEmptyId(target.node, `${path}.node`, `${label} node id`);
      return true;
    }
    if (target.kind === "group") {
      if (!Array.isArray(target.nodes)) {
        out.push(
          "type",
          `${path}.nodes`,
          `${label} group nodes must be an array`,
          target.nodes,
        );
        return false;
      }
      target.nodes.forEach((node, j) =>
        validateNonEmptyId(
          node,
          `${path}.nodes[${j}]`,
          `${label} group node id`,
        ),
      );
      return true;
    }
    return true;
  };

  validateNonEmptyId(performance.beat, "$input.beat", "beat id");

  const foundBeat = beatById.get(performance.beat);
  if (foundBeat === undefined)
    out.push(
      "type",
      "$input.beat",
      `beat "${performance.beat}" must be one of the script's beats`,
      performance.beat,
    );
  const beat = foundBeat?.beat;

  if (!Number.isFinite(performance.duration) || !(performance.duration > 0))
    out.push(
      "range",
      "$input.duration",
      `shot duration must be a finite number > 0 seconds, but was ${performance.duration}`,
      performance.duration,
    );

  const actions = performance.revise.final ?? performance.draft;
  const base =
    performance.revise.final !== null ? "$input.revise.final" : "$input.draft";

  const nodeIds = new Set(staged.scene.nodes.map((n) => n.id));
  const cameraIds = new Set(staged.scene.cameras.map((c) => c.id));

  // Every placed thing a target may name, cameras included (#1294): one table
  // shared with the reference synthesizer, so a target the gate accepts is a
  // target the performer can actually aim at.
  const nodePositions = scenePlacements(staged.scene);
  const nodeRotations = new Map(
    staged.scene.nodes.map((n) => [n.id, n.transform.rotation]),
  );

  const resolvePositionalTarget = (
    target: unknown,
    path: string,
    label: string,
    subject: string,
  ): IAutoMovieVector3 | null => {
    if (!validateTargetNodeIds(target, path, label)) return null;
    const point = resolveTargetPoint(target, nodePositions);
    if (point === null || point === undefined) {
      out.push(
        "type",
        path,
        `${subject} must resolve to a point (${POSITIONAL_TARGET_SHAPE}), but ${positionalTargetFault(target)}`,
        target,
      );
      return null;
    }
    return point;
  };

  let liveCamera: string | null = null;
  const stageActions: IAutoMovieActionCall[] = [];
  const frames: { action: IAutoMovieCameraAction; index: number }[] = [];
  // Launch jobs collected while validating, the projectile must be a staged
  // node and the target must resolve to a point; compiled after the input
  // gate (below) into the projectile's flight and the target's scheduled react.
  const launches: {
    action: IAutoMovieActionCall & { verb: "launch" };
    index: number;
    origin: IAutoMovieVector3;
    target: IAutoMovieVector3;
    targetNode: string | null;
  }[] = [];
  // Attach jobs, the parent must be a staged, rigged node carrying the target
  // bone; the child's follow-clip is baked after the parent's pose compiles.
  const attachments: {
    action: IAutoMovieActionCall & { verb: "attachTo" };
    index: number;
  }[] = [];
  actions.forEach((action, i) => {
    const actors = actionActors(action);
    if (typeof action.actor === "string")
      validateNonEmptyId(
        action.actor,
        `${base}[${i}].actor`,
        "action actor id",
      );
    else if (Array.isArray(action.actor)) {
      if (action.actor.length === 0)
        out.push(
          "type",
          `${base}[${i}].actor`,
          "an action actor list must name at least one staged scene node or camera",
          action.actor,
        );
      const seen = new Set<string>();
      action.actor.forEach((actor, j) => {
        validateNonEmptyId(
          actor,
          `${base}[${i}].actor[${j}]`,
          "action actor id",
        );
        if (seen.has(actor))
          out.push(
            "type",
            `${base}[${i}].actor[${j}]`,
            `actor "${actor}" is duplicated in this action's actor list`,
            actor,
          );
        seen.add(actor);
      });
    } else {
      out.push(
        "type",
        `${base}[${i}].actor`,
        "action actor must be a staged scene node id or an array of ids",
        action.actor,
      );
    }
    actors.forEach((actor) => {
      const isNode = nodeIds.has(actor);
      const isCamera = cameraIds.has(actor);
      if (!isNode && !isCamera)
        out.push(
          "type",
          `${base}[${i}].actor`,
          `actor "${actor}" must be a staged scene node or camera`,
          actor,
        );
      else if (action.verb !== "frame" && isCamera)
        out.push(
          "type",
          `${base}[${i}].actor`,
          `a ${action.verb} action's actor must be a staged scene node, but "${actor}" is a camera`,
          actor,
        );
    });
    const finiteStart = Number.isFinite(action.start);
    if (!finiteStart || action.start < 0 || action.start > performance.duration)
      out.push(
        "range",
        `${base}[${i}].start`,
        `action start must be within [0, ${performance.duration}] (the shot), but was ${action.start}`,
        action.start,
      );
    const finiteDuration =
      action.duration === "auto" || Number.isFinite(action.duration);
    if (
      action.duration !== "auto" &&
      (!finiteDuration || !(action.duration > 0))
    )
      out.push(
        "range",
        `${base}[${i}].duration`,
        `action duration must be a finite number > 0 seconds or "auto", but was ${action.duration}`,
        action.duration,
      );
    if (
      action.duration !== "auto" &&
      finiteStart &&
      finiteDuration &&
      action.start + action.duration > performance.duration
    )
      out.push(
        "range",
        `${base}[${i}].duration`,
        `action span [${action.start}, ${action.start + action.duration}] must lie inside the shot [0, ${performance.duration}]`,
        action.duration,
      );
    // An "auto" duration fills to the shot end, so it needs a positive span to
    // fill: an action that starts exactly at the shot end has zero span. A
    // numeric duration is already caught above (start + duration > shot); the
    // auto case is not span-checked there, and a zero-span auto coupling bakes
    // a degenerate clip with duplicate keyframe times that throws the moment
    // anything samples it. `start > shot` is already reported as a start range
    // error, so this fires only on the exact `start === shot` remainder.
    if (
      action.duration === "auto" &&
      finiteStart &&
      action.start <= performance.duration &&
      performance.duration - action.start <= 0
    )
      out.push(
        "range",
        `${base}[${i}].duration`,
        `an "auto" duration leaves no span when the action starts at the shot end (${performance.duration}s), start earlier`,
        action.duration,
      );
    if (
      action.repeat !== undefined &&
      (!Number.isInteger(action.repeat) || action.repeat < 1)
    )
      out.push(
        "range",
        `${base}[${i}].repeat`,
        `action repeat must be a positive integer when present, but was ${action.repeat}`,
        action.repeat,
      );
    if (action.verb === "frame") {
      const camera = typeof action.actor === "string" ? action.actor : "";
      if (!CAMERA_FRAMINGS.has(action.framing))
        out.push(
          "type",
          `${base}[${i}].framing`,
          `camera framing must be one of wide, full, medium, close, but was "${String(action.framing)}"`,
          action.framing,
        );
      if (!CAMERA_MOVES.has(action.move))
        out.push(
          "type",
          `${base}[${i}].move`,
          `camera move must be one of static, follow, orbit, push-in, whip, but was "${String(action.move)}"`,
          action.move,
        );
      const target = resolvePositionalTarget(
        action.on,
        `${base}[${i}].on`,
        "frame target",
        "a frame subject",
      );
      // The two lens INTENTS (#1187): validated like any target/scalar, but
      // never consumed by the camera solve, they ride to shot.cameraIntent.
      if (action.focus !== undefined)
        resolvePositionalTarget(
          action.focus,
          `${base}[${i}].focus`,
          "focus target",
          "a focus subject",
        );
      if (
        action.focalLength !== undefined &&
        (!Number.isFinite(action.focalLength) || !(action.focalLength > 0))
      )
        out.push(
          "range",
          `${base}[${i}].focalLength`,
          `a focal length must be a finite number > 0 mm, but was ${action.focalLength}`,
          action.focalLength,
        );
      if (typeof action.actor !== "string")
        out.push(
          "type",
          `${base}[${i}].actor`,
          `a frame action must name exactly one staged camera, not an actor list`,
          action.actor,
        );
      if (typeof action.actor === "string" && !cameraIds.has(camera))
        out.push(
          "type",
          `${base}[${i}].actor`,
          `a frame action's actor must be a staged camera, but "${camera}" is not`,
          camera,
        );
      else if (typeof action.actor === "string" && liveCamera === null)
        liveCamera = camera;
      else if (typeof action.actor === "string" && liveCamera !== camera)
        out.push(
          "type",
          `${base}[${i}].actor`,
          `one live camera per shot, "${liveCamera}" already frames it`,
          camera,
        );
      if (target !== null) frames.push({ action, index: i });
    } else {
      stageActions.push(action);
      if (action.verb === "locomote" && gaits !== undefined) {
        // A locomote names a gait by the actor's own vocabulary; the reference
        // synthesiser resolves it by name and would otherwise silently produce
        // no motion for an unknown one. Surface it as a violation so the gap
        // between the free-string schema and the actor's actual gaits is caught.
        actors.forEach((actor) => {
          const available = gaits(actor);
          if (available !== undefined && !available.includes(action.gait))
            out.push(
              "type",
              `${base}[${i}].gait`,
              `locomote gait "${action.gait}" is not one of actor "${actor}"'s gaits (${
                available.length === 0 ? "none supplied" : available.join(", ")
              })`,
              action.gait,
            );
        });
      }
      if (action.verb === "launch") {
        // The projectile is a scene object, so it must be staged (its placed
        // position is where the flight begins), and the aim must resolve to a
        // point. A node aim also names the actor the hit recoils; a point/group
        // aim flies but recoils no one (no single actor). Out-of-range is
        // caught below, once the aim is solved.
        if (!Number.isFinite(action.speed) || !(action.speed > 0))
          out.push(
            "range",
            `${base}[${i}].speed`,
            `a launch speed must be a finite number > 0 m/s, but was ${action.speed}`,
            action.speed,
          );
        if (
          action.onHit !== undefined &&
          !(action.onHit.force >= 0 && action.onHit.force <= 1)
        )
          out.push(
            "range",
            `${base}[${i}].onHit.force`,
            `reaction force must be within [0, 1], but was ${action.onHit.force}`,
            action.onHit.force,
          );
        validateNonEmptyId(
          action.projectile,
          `${base}[${i}].projectile`,
          "launch projectile id",
        );
        const target = resolvePositionalTarget(
          action.at,
          `${base}[${i}].at`,
          "launch target",
          "a launch target",
        );
        const stagedProjectile = nodeIds.has(action.projectile);
        if (!stagedProjectile)
          out.push(
            "type",
            `${base}[${i}].projectile`,
            `a launch's projectile "${action.projectile}" must be a staged scene node`,
            action.projectile,
          );
        if (actors.includes(action.projectile))
          out.push(
            "type",
            `${base}[${i}].projectile`,
            `a launch's projectile "${action.projectile}" cannot also be a launching actor`,
            action.projectile,
          );
        if (
          isRecord(action.at) &&
          action.at.kind === "node" &&
          action.at.node === action.projectile
        )
          out.push(
            "type",
            `${base}[${i}].at`,
            `a launch's projectile "${action.projectile}" cannot target itself`,
            action.at,
          );
        if (stagedProjectile && target !== null)
          launches.push({
            action,
            index: i,
            origin: nodePositions.get(action.projectile)!,
            target,
            targetNode:
              isRecord(action.at) &&
              action.at.kind === "node" &&
              typeof action.at.node === "string"
                ? action.at.node
                : null,
          });
      } else if (action.verb === "enact") {
        // The clip id is the caller's handle into host-supplied content; the
        // synthesizer resolves it, but an empty id can never resolve.
        validateNonEmptyId(action.clip, `${base}[${i}].clip`, "enact clip id");
      } else if (
        action.verb === "react" &&
        !(action.force >= 0 && action.force <= 1)
      ) {
        out.push(
          "range",
          `${base}[${i}].force`,
          `reaction force must be within [0, 1], but was ${action.force}`,
          action.force,
        );
      } else if (
        action.verb === "emote" &&
        !(action.intensity >= 0 && action.intensity <= 1)
      ) {
        out.push(
          "range",
          `${base}[${i}].intensity`,
          `emote intensity must be within [0, 1], but was ${action.intensity}`,
          action.intensity,
        );
      } else if (action.verb === "lookAt") {
        resolvePositionalTarget(
          action.to,
          `${base}[${i}].to`,
          "lookAt target",
          "a lookAt target",
        );
      } else if (action.verb === "reach") {
        resolvePositionalTarget(
          action.to,
          `${base}[${i}].to`,
          "reach target",
          "a reach target",
        );
      } else if (
        action.verb === "gesture" &&
        (action.kind === "point" || action.kind === "strike")
      ) {
        if (action.at !== undefined)
          resolvePositionalTarget(
            action.at,
            `${base}[${i}].at`,
            `${action.kind} gesture target`,
            `a ${action.kind} gesture target`,
          );
        else
          out.push(
            "type",
            `${base}[${i}].at`,
            `a ${action.kind} gesture target must resolve to a point (${POSITIONAL_TARGET_SHAPE}), but none was given`,
            action.at,
          );
      } else if (action.verb === "attachTo") {
        // The child rides a bone of the parent, so the parent must be a staged,
        // rigged node carrying that bone. The child's follow-clip is baked
        // after the parent's pose compiles (it samples that motion).
        for (const child of actors)
          if (child === action.parent)
            out.push(
              "type",
              `${base}[${i}].actor`,
              `an attachTo child "${child}" cannot attach to itself`,
              child,
            );
        validateNonEmptyId(
          action.parent,
          `${base}[${i}].parent`,
          "attach parent id",
        );
        const parentRig = nodeIds.has(action.parent)
          ? skeleton(action.parent)
          : null;
        if (!nodeIds.has(action.parent))
          out.push(
            "type",
            `${base}[${i}].parent`,
            `an attachTo parent "${action.parent}" must be a staged scene node`,
            action.parent,
          );
        else if (parentRig === null)
          out.push(
            "type",
            `${base}[${i}].parent`,
            `an attachTo parent "${action.parent}" must have a rig to attach a bone of`,
            action.parent,
          );
        else if (!parentRig.bones.some((b) => b.bone === action.bone))
          out.push(
            "type",
            `${base}[${i}].bone`,
            `bone "${action.bone}" is not on ${action.parent}'s skeleton`,
            action.bone,
          );
        else attachments.push({ action, index: i });
      }
    }
  });

  const spanOf = (action: IAutoMovieActionCall): [number, number] => [
    action.start,
    action.duration === "auto"
      ? performance.duration
      : Math.min(action.start + action.duration, performance.duration),
  ];

  // Frame moves on the one live camera must not overlap. An "auto" duration
  // yields to the next move by definition (its span ends where the successor
  // starts), so only an explicit duration can double-book the camera.
  frames.sort((a, b) => a.action.start - b.action.start);
  for (let i = 0; i + 1 < frames.length; ++i) {
    const move = frames[i]!.action;
    const next = frames[i + 1]!.action;
    if (next.start <= move.start + 1e-9) {
      out.push(
        "range",
        `${base}[${frames[i + 1]!.index}].start`,
        `frame moves share the same start time ${next.start}s on the live camera; choose one framing for that instant`,
        next.start,
      );
      continue;
    }
    if (move.duration === "auto") continue;
    const end = Math.min(move.start + move.duration, performance.duration);
    if (end > next.start + 1e-9)
      out.push(
        "range",
        `${base}[${frames[i + 1]!.index}].start`,
        `frame moves overlap, the previous move runs until ${end}s, but this one starts at ${frames[i + 1]!.action.start}s`,
        frames[i + 1]!.action.start,
      );
  }

  // A body region can run only one authored action at a time. Disjoint partial
  // regions may layer, but same-region overlaps would force arrangeMotion to
  // drop keyframes, and fullBody owns every partial region.
  const actorActions = new Map<
    string,
    { action: IAutoMovieActionCall; index: number }[]
  >();
  actions.forEach((action, index) => {
    if (action.verb === "frame") return;
    for (const actor of actionActors(action)) {
      const list = actorActions.get(actor) ?? [];
      list.push({ action, index });
      actorActions.set(actor, list);
    }
  });
  for (const [actor, list] of actorActions) {
    const sorted = [...list].sort(
      (a, b) => spanOf(a.action)[0] - spanOf(b.action)[0],
    );
    for (let i = 0; i + 1 < sorted.length; ++i) {
      const a = sorted[i]!;
      const [a0, a1] = spanOf(a.action);
      const aRegion = actionRegion(a.action);
      for (let j = i + 1; j < sorted.length; ++j) {
        const b = sorted[j]!;
        const [b0, b1] = spanOf(b.action);
        if (b0 >= a1 - 1e-9) break;
        const bRegion = actionRegion(b.action);
        const sameRegionConflict = aRegion === bRegion;
        // `face` carries EXPRESSION only, no gesture clip authors it, so a
        // fullBody action shares zero content with an overlapping emote and
        // "smile while bowing" must stay legal (#1062). `head` stays in the
        // conflict: whole-body clips may author head/neck joints.
        const fullBodyConflict =
          aRegion !== bRegion &&
          (aRegion === "fullBody" || bRegion === "fullBody") &&
          aRegion !== "face" &&
          bRegion !== "face";
        if (sameRegionConflict && b1 > a0 + 1e-9)
          out.push(
            "range",
            `${base}[${b.index}].start`,
            `${actor} has overlapping ${aRegion} actions; one body region cannot run two authored clips at the same time`,
            b.action.start,
          );
        else if (fullBodyConflict && b1 > a0 + 1e-9)
          out.push(
            "range",
            `${base}[${b.index}].start`,
            `${actor} has overlapping ${aRegion} and ${bRegion} actions; fullBody cannot layer with a partial body region`,
            b.action.start,
          );
      }
    }
  }

  // Blocking coherence: when the beat was blocked, the performance must
  // realize that plan, not another one. The beat and duration must match,
  // every timing anchor must be covered by some action of its actor (an
  // anchored key moment nobody performs is a dropped beat), and the camera
  // intent must be honoured by the first frame move, or, for a static
  // intent, a locked-off camera will do.
  if (blocking !== undefined) {
    if (blocking.beat !== performance.beat)
      out.push(
        "type",
        "$input.beat",
        `the performance realizes beat "${performance.beat}" but the blocking plans "${blocking.beat}"`,
        performance.beat,
      );
    if (Math.abs(blocking.duration - performance.duration) > 1e-6)
      out.push(
        "range",
        "$input.duration",
        `the blocking fixed this beat at ${blocking.duration}s, but the performance runs ${performance.duration}s`,
        performance.duration,
      );

    for (const intent of blocking.actors)
      for (const anchor of intent.anchors ?? []) {
        const covered = stageActions.some((action) => {
          if (!actionActors(action).includes(intent.node)) return false;
          const [from, to] = spanOf(action);
          return anchor.t >= from - 1e-9 && anchor.t <= to + 1e-9;
        });
        if (!covered)
          out.push(
            "range",
            base,
            `anchor "${anchor.cue}" pins ${intent.node} at t=${anchor.t}s, but no action of that actor covers the instant`,
            anchor.t,
          );
      }

    const lead = frames[0];
    if (lead === undefined) {
      if (blocking.camera.move !== "static")
        out.push(
          "type",
          base,
          `the blocking asks for a "${blocking.camera.move}" camera, but no frame action authors it`,
          blocking.camera.move,
        );
    } else {
      if (lead.action.framing !== blocking.camera.framing)
        out.push(
          "type",
          `${base}[${lead.index}].framing`,
          `the blocking frames this beat "${blocking.camera.framing}", but the performance frames "${lead.action.framing}"`,
          lead.action.framing,
        );
      if (lead.action.move !== blocking.camera.move)
        out.push(
          "type",
          `${base}[${lead.index}].move`,
          `the blocking moves the camera "${blocking.camera.move}", but the performance moves "${lead.action.move}"`,
          lead.action.move,
        );
    }
  }

  if (liveCamera === null) {
    const first = staged.scene.cameras[0];
    if (first === undefined)
      out.push(
        "type",
        "$input",
        "the staged scene has no camera, so the shot cannot be framed",
        performance.beat,
      );
    else liveCamera = first.id;
  }

  if (out.items.length > 0) return { success: false, violations: out.items };

  // Launch: solve each aim, bake the projectile's flight into an object clip,
  // and fold the target's engine-timed recoil into the action list so the
  // performance compiles it. Do this before `compilePerformance`, the injected
  // reacts must ride the same synthesis and ROM gate as authored ones. A launch
  // that cannot reach its target at the given speed is a range violation.
  const objectMotions: IAutoMovieClip[] = [];
  const trajectoryCounts = new Map<string, number>();
  const events: IAutoMovieInteractionEvent[] = [];
  for (const job of launches) {
    // Lead a moving target: when the struck node travels during the shot (it
    // carries a `locomote`), resolve where it WILL be rather than aiming at its
    // start. Compile just that node's own motion for the animated position,
    // node-local root rotated into the world by its staged facing, the same
    // read a `follow` camera uses. Its own recoil fires at impact, past the
    // lead window, so it does not perturb the pre-hit path. A static target
    // keeps the plain intercept.
    let targetAt: ((t: number) => IAutoMovieVector3) | undefined;
    const targetsNode = (action: IAutoMovieActionCall): boolean =>
      job.targetNode !== null && actionActors(action).includes(job.targetNode);
    if (
      job.targetNode !== null &&
      stageActions.some(
        (action) => action.verb === "locomote" && targetsNode(action),
      )
    )
      targetAt = animatedBaseAt(
        nodePositions.get(job.targetNode)!,
        nodeRotations.get(job.targetNode)!,
        // just this node's own motion, its recoil fires at impact, past the
        // lead window, so it never perturbs the pre-hit path being sampled.
        compilePerformance(
          stageActions.filter((action) => targetsNode(action)),
          synthesize,
        )[job.targetNode]!,
      );
    const result = compileLaunch({
      action: job.action,
      origin: job.origin,
      target: job.target,
      targetNode: job.targetNode,
      targetAt,
    });
    if (result === null) {
      out.push(
        "range",
        `${base}[${job.index}].speed`,
        `the launch cannot reach its target at ${job.action.speed} m/s, raise the speed or move the shooter closer`,
        job.action.speed,
      );
      continue;
    }
    // The baked flight is clip-local (0 → hitTime); place it on the shot clock
    // so it launches at the action's start and lands exactly when the react
    // fires (start + hitTime). Times shift by start; the clip spans the shot,
    // holding at the origin before launch and at the target after (sampleClip
    // clamps), the same shot-local convention as `cameraMotion`.
    const hitAt = job.action.start + result.hitTime;
    if (hitAt > performance.duration + 1e-9) {
      out.push(
        "range",
        `${base}[${job.index}].speed`,
        `the launch lands at ${hitAt}s, outside the shot ending at ${performance.duration}s, fire earlier, raise the speed, or lengthen the shot`,
        job.action.speed,
      );
      continue;
    }
    // Repeated launches of one projectile node would collide on the stable
    // `trajectory:<node>` id (#989); suffix later flights so the shot stays
    // committable (`validateUniqueIds` on objectMotions).
    const flightCount = (trajectoryCounts.get(result.clip.id) ?? 0) + 1;
    trajectoryCounts.set(result.clip.id, flightCount);
    objectMotions.push({
      ...result.clip,
      id:
        flightCount === 1 ? result.clip.id : `${result.clip.id}:${flightCount}`,
      duration: performance.duration,
      tracks: result.clip.tracks.map((track) => ({
        ...track,
        times: track.times.map((t) => t + job.action.start),
      })),
    });
    events.push(
      ...result.events.map((event) => ({
        ...event,
        actionIndex: job.index,
      })),
    );
    // The injected react stays EXEMPT from the region-overlap gate (#1003
    // decision): the engine schedules it at a computed hit instant the model
    // cannot know, and the flagship idiom is a MOVING target, rejecting the
    // overlap would make `onHit` unusable exactly where it matters. The
    // layering envelope bounds its blend to the flinch window, so the
    // disruption reads as the hit interrupting the stride, not as a
    // shot-long dilution.
    if (result.react !== null) stageActions.push(result.react);
  }
  if (out.items.length > 0) return { success: false, violations: out.items };

  const motions = compilePerformance(stageActions, synthesize);
  for (const [node, motion] of Object.entries(motions)) {
    const rig = skeleton(node);
    if (rig === null) continue;
    const validated = validateMotion({ motion, skeleton: rig });
    if (validated.success === false)
      for (const violation of validated.violations)
        out.items.push({
          ...violation,
          path: violation.path.replace("$input", `$compiled["${node}"]`),
        });
  }
  if (out.items.length > 0) return { success: false, violations: out.items };

  // Couple objects: bake the per-beat `attachTo` handoffs and the persistent
  // staged `mounts` into follow clips now that the parents' poses have compiled
  // (see {@link coupleObjects}). Mount preconditions (parent rig, saddle bone)
  // surface as violations here, the first place with skeleton access.
  const coupled = coupleObjects({
    attachments,
    mounts: staged.mounts,
    scene: staged.scene,
    motions,
    skeleton,
    restFrames,
    duration: performance.duration,
  });
  objectMotions.push(...coupled.clips);
  events.push(...coupled.events);
  out.items.push(...coupled.violations);
  if (out.items.length > 0) return { success: false, violations: out.items };

  // Compile the live camera's move from its frame actions. Subjects resolve
  // against the staged placements; a node subject's height is measured from
  // its rig's rest pose (staging doctrine: measure, don't hope), and its
  // animated base rides the compiled clip's root displacement so `follow`
  // tracks a walking actor.
  const cameraObject = staged.scene.cameras.find((c) => c.id === liveCamera)!;
  const entries: IAutoMovieCameraFrameEntry[] = frames.map(({ action }) => {
    const point = resolveTargetPoint(action.on, nodePositions)!;
    const node = action.on.kind === "node" ? action.on.node : null;
    const rig = node === null ? null : skeleton(node);
    const measured = rig === null ? 0 : computeRestHeight(rig);
    const motion = node === null ? undefined : motions[node];
    return {
      action,
      subject: {
        base: point,
        height: measured >= 0.1 ? measured : DEFAULT_SUBJECT_HEIGHT,
        // The animated base rides the node-local root under its staged facing,
        // the same read a leading launch uses (see animatedBaseAt).
        at:
          motion === undefined
            ? null
            : animatedBaseAt(point, nodeRotations.get(node!)!, motion),
      },
    };
  });
  const cameraMotion = compileCameraMove({
    clipId: `cam:${performance.beat}`,
    camera: cameraObject,
    entries,
    shotDuration: performance.duration,
  });

  return {
    success: true,
    shot: {
      id: `shot:${performance.beat}`,
      name: beat!.name,
      scene: staged.scene.id,
      camera: liveCamera!,
      cameraMotion,
      performances: Object.entries(motions).map(([node, motion]) => ({
        node,
        motion: motion.id,
        startOffset: 0,
      })),
      objectMotions,
      events: orderEvents(events),
      // Directorial intent per frame span (#1187): the focus subject resolves
      // to a world point the same way `on` did; the solve itself never reads
      // these, a diffusion/render host does, beside cameraMotion.
      cameraIntent: frames.map(({ action }) => ({
        start: action.start,
        framing: action.framing,
        move: action.move,
        focus:
          action.focus === undefined
            ? null
            : resolveTargetPoint(action.focus, nodePositions)!,
        focalLength: action.focalLength ?? null,
      })),
      duration: performance.duration,
    },
    motions,
  };
};
