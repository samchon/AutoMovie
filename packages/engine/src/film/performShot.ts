import {
  IAutoMovieActionCall,
  IAutoMovieBlockingApplication,
  IAutoMovieCameraAction,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMovieQuaternion,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";
import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
} from "../perform/compilePerformance";
import { resolveTargetPoint } from "../perform/resolveTargetPoint";
import { validateMotion } from "../validation/validateMotion";
import { ViolationCollector } from "../validation/violation";
import {
  DEFAULT_SUBJECT_HEIGHT,
  IAutoMovieCameraFrameEntry,
  compileCameraMove,
  computeRestHeight,
} from "./cameraMove";
import { compileAttach } from "./compileAttach";
import { compileLaunch } from "./compileLaunch";
import { IAutoMovieStagedSet } from "./stageScene";

/**
 * A node's animated **world** position over shot time: its staged `base` plus
 * the node-local root displacement of `motion` at that instant, rotated into
 * the world by the node's staged `facing`. The read shared by a `follow` camera
 * tracking a walking actor and a `launch` leading a moving target — one place,
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

/**
 * A performed shot: the assembled {@link IAutoMovieShot} plus the dense motion
 * clips the compiler synthesised for it. The clips travel alongside the shot
 * because the shot references them by id — the host registers them wherever its
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
 * The PERFORMANCE consumer — fold one beat's action calls into an
 * {@link IAutoMovieShot} through {@link compilePerformance}, gating both sides of
 * the seam: the calls must reference the staged world (a beat the script
 * planned, actors the stage placed), and the clips the synthesizer fattened
 * them into must survive `validateMotion` against each actor's skeleton. The
 * revise pass wins by construction: `revise.final ?? draft` is the list that
 * performs.
 *
 * Camera `frame` actions elect the live camera and author its move: the first
 * one names the shot's camera (staging aimed it already), rival `frame` calls
 * on a second camera are a violation — one take, one live camera — and the
 * elected camera's frame actions compile into `cameraMotion` through
 * {@link compileCameraMove}'s framing grammar. Frame subjects must resolve to a
 * point (node/point/group), and same-camera moves must not overlap in time. A
 * shot with no `frame` call falls back to the scene's first camera, locked off
 * (`cameraMotion: null`); a scene with no cameras at all cannot be framed and
 * fails.
 *
 * `launch` actions are compiled through {@link compileLaunch}: the projectile (a
 * staged scene node) gets its baked flight as a shot `objectMotion`, and — for
 * a node aim carrying `onHit` — the struck actor's recoil is folded into the
 * action list at the **engine-computed** contact, so it rides the same
 * synthesis and ROM gate as an authored `react`. The projectile must be staged,
 * the aim must resolve to a point, and the shot must reach the target at the
 * given speed — each an input violation otherwise.
 *
 * `attachTo` actions are compiled through {@link compileAttach} once the parent
 * pose is known: the coupled child (a prop, not a rig) gets a shot
 * `objectMotion` that rides the parent's bone in scene space each frame. The
 * parent must be a staged, rigged node carrying the named bone — each an input
 * violation otherwise.
 *
 * @param props.skeleton Rig lookup for ROM validation; return null for a node
 *   that has no skeleton (its clip skips ROM).
 */
export const performShot = (props: {
  script: IAutoMovieScriptApplication.IWrite;
  staged: IAutoMovieStagedSet.ISuccess;
  performance: IAutoMoviePerformanceApplication.IWrite;
  synthesize: IAutoMovieActionSynthesizer;
  skeleton: (node: string) => IAutoMovieSkeleton | null;
  /**
   * The beat's validated blocking (from `blockBeat`), when the pipeline runs
   * the full stage ladder. Supplying it arms the coherence gates between intent
   * and realization: matching beat and duration, every timing anchor covered by
   * an action of its actor, and the camera intent honoured.
   */
  blocking?: IAutoMovieBlockingApplication.IWrite;
}): IAutoMoviePerformedShot => {
  const { script, staged, performance, synthesize, skeleton, blocking } = props;
  const out = new ViolationCollector();

  const beat = script.beats.find((b) => b.id === performance.beat);
  if (beat === undefined)
    out.push(
      "type",
      "$input.beat",
      `beat "${performance.beat}" must be one of the script's beats`,
      performance.beat,
    );

  if (!(performance.duration > 0))
    out.push(
      "range",
      "$input.duration",
      `shot duration must be > 0 seconds, but was ${performance.duration}`,
      performance.duration,
    );

  const actions = performance.revise.final ?? performance.draft;
  const base =
    performance.revise.final !== null ? "$input.revise.final" : "$input.draft";

  const nodeIds = new Set(staged.scene.nodes.map((n) => n.id));
  const cameraIds = new Set(staged.scene.cameras.map((c) => c.id));

  const nodePositions = new Map<string, IAutoMovieVector3>(
    staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
  );
  const nodeRotations = new Map(
    staged.scene.nodes.map((n) => [n.id, n.transform.rotation]),
  );

  let liveCamera: string | null = null;
  const stageActions: IAutoMovieActionCall[] = [];
  const frames: { action: IAutoMovieCameraAction; index: number }[] = [];
  // Launch jobs collected while validating — the projectile must be a staged
  // node and the target must resolve to a point; compiled after the input
  // gate (below) into the projectile's flight and the target's scheduled react.
  const launches: {
    action: IAutoMovieActionCall & { verb: "launch" };
    index: number;
    origin: IAutoMovieVector3;
    target: IAutoMovieVector3;
    targetNode: string | null;
  }[] = [];
  // Attach jobs — the parent must be a staged, rigged node carrying the target
  // bone; the child's follow-clip is baked after the parent's pose compiles.
  const attachments: {
    action: IAutoMovieActionCall & { verb: "attachTo" };
    index: number;
  }[] = [];
  actions.forEach((action, i) => {
    const actors =
      typeof action.actor === "string" ? [action.actor] : action.actor;
    actors.forEach((actor) => {
      if (!nodeIds.has(actor) && !cameraIds.has(actor))
        out.push(
          "type",
          `${base}[${i}].actor`,
          `actor "${actor}" must be a staged scene node or camera`,
          actor,
        );
    });
    if (action.start < 0 || action.start > performance.duration)
      out.push(
        "range",
        `${base}[${i}].start`,
        `action start must be within [0, ${performance.duration}] (the shot), but was ${action.start}`,
        action.start,
      );
    if (action.verb === "frame") {
      const camera = actors[0]!;
      if (!cameraIds.has(camera))
        out.push(
          "type",
          `${base}[${i}].actor`,
          `a frame action's actor must be a staged camera, but "${camera}" is not`,
          camera,
        );
      else if (liveCamera === null) liveCamera = camera;
      else if (liveCamera !== camera)
        out.push(
          "type",
          `${base}[${i}].actor`,
          `one live camera per shot — "${liveCamera}" already frames it`,
          camera,
        );
      if (resolveTargetPoint(action.on, nodePositions) === null)
        out.push(
          "type",
          `${base}[${i}].on`,
          `a frame subject must resolve to a point — a node/point/group of placed actors, not "${action.on.kind}"`,
          action.on,
        );
      frames.push({ action, index: i });
    } else {
      stageActions.push(action);
      if (action.verb === "launch") {
        // The projectile is a scene object, so it must be staged (its placed
        // position is where the flight begins), and the aim must resolve to a
        // point. A node aim also names the actor the hit recoils; a point/group
        // aim flies but recoils no one (no single actor). Out-of-range is
        // caught below, once the aim is solved.
        const stagedProjectile = nodeIds.has(action.projectile);
        if (!stagedProjectile)
          out.push(
            "type",
            `${base}[${i}].projectile`,
            `a launch's projectile "${action.projectile}" must be a staged scene node`,
            action.projectile,
          );
        const target = resolveTargetPoint(action.at, nodePositions);
        if (target === null)
          out.push(
            "type",
            `${base}[${i}].at`,
            `a launch target must resolve to a point — a node/point/group of placed actors, not "${action.at.kind}"`,
            action.at,
          );
        if (stagedProjectile && target !== null)
          launches.push({
            action,
            index: i,
            origin: nodePositions.get(action.projectile)!,
            target,
            targetNode: action.at.kind === "node" ? action.at.node : null,
          });
      } else if (action.verb === "attachTo") {
        // The child rides a bone of the parent, so the parent must be a staged,
        // rigged node carrying that bone. The child's follow-clip is baked
        // after the parent's pose compiles (it samples that motion).
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

  // Frame moves on the one live camera must not overlap. An "auto" duration
  // yields to the next move by definition (its span ends where the successor
  // starts), so only an explicit duration can double-book the camera.
  frames.sort((a, b) => a.action.start - b.action.start);
  for (let i = 0; i + 1 < frames.length; ++i) {
    const move = frames[i]!.action;
    if (move.duration === "auto") continue;
    const end = Math.min(move.start + move.duration, performance.duration);
    if (end > frames[i + 1]!.action.start + 1e-9)
      out.push(
        "range",
        `${base}[${frames[i + 1]!.index}].start`,
        `frame moves overlap — the previous move runs until ${end}s, but this one starts at ${frames[i + 1]!.action.start}s`,
        frames[i + 1]!.action.start,
      );
  }

  // Blocking coherence: when the beat was blocked, the performance must
  // realize that plan, not another one. The beat and duration must match,
  // every timing anchor must be covered by some action of its actor (an
  // anchored key moment nobody performs is a dropped beat), and the camera
  // intent must be honoured by the first frame move — or, for a static
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

    const spanOf = (action: IAutoMovieActionCall): [number, number] => [
      action.start,
      action.duration === "auto"
        ? performance.duration
        : Math.min(action.start + action.duration, performance.duration),
    ];
    for (const intent of blocking.actors)
      for (const anchor of intent.anchors ?? []) {
        const covered = stageActions.some((action) => {
          const actors =
            typeof action.actor === "string" ? [action.actor] : action.actor;
          if (!actors.includes(intent.node)) return false;
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
  // performance compiles it. Do this before `compilePerformance` — the injected
  // reacts must ride the same synthesis and ROM gate as authored ones. A launch
  // that cannot reach its target at the given speed is a range violation.
  const objectMotions: IAutoMovieClip[] = [];
  for (const job of launches) {
    // Lead a moving target: when the struck node travels during the shot (it
    // carries a `locomote`), resolve where it WILL be rather than aiming at its
    // start. Compile just that node's own motion for the animated position —
    // node-local root rotated into the world by its staged facing, the same
    // read a `follow` camera uses. Its own recoil fires at impact, past the
    // lead window, so it does not perturb the pre-hit path. A static target
    // keeps the plain intercept.
    let targetAt: ((t: number) => IAutoMovieVector3) | undefined;
    if (
      job.targetNode !== null &&
      stageActions.some(
        (a) => a.actor === job.targetNode && a.verb === "locomote",
      )
    )
      targetAt = animatedBaseAt(
        nodePositions.get(job.targetNode)!,
        nodeRotations.get(job.targetNode)!,
        // just this node's own motion — its recoil fires at impact, past the
        // lead window, so it never perturbs the pre-hit path being sampled.
        compilePerformance(
          stageActions.filter((a) => a.actor === job.targetNode),
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
        `the launch cannot reach its target at ${job.action.speed} m/s — raise the speed or move the shooter closer`,
        job.action.speed,
      );
      continue;
    }
    // The baked flight is clip-local (0 → hitTime); place it on the shot clock
    // so it launches at the action's start and lands exactly when the react
    // fires (start + hitTime). Times shift by start; the clip spans the shot,
    // holding at the origin before launch and at the target after (sampleClip
    // clamps) — the same shot-local convention as `cameraMotion`.
    objectMotions.push({
      ...result.clip,
      duration: performance.duration,
      tracks: result.clip.tracks.map((track) => ({
        ...track,
        times: track.times.map((t) => t + job.action.start),
      })),
    });
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

  // Attach: bake each coupled child's follow-clip now that the parent's pose
  // has compiled. The child rides the parent's bone in scene space (staged
  // placement ∘ per-frame FK), resolved with the same joint axes the renderer
  // poses the parent by; a parent that only holds rest yields a static child.
  for (const job of attachments) {
    const parentNode = staged.scene.nodes.find(
      (n) => n.id === job.action.parent,
    )!;
    const parentRig = skeleton(job.action.parent)!;
    const end =
      job.action.duration === "auto"
        ? performance.duration
        : Math.min(
            job.action.start + job.action.duration,
            performance.duration,
          );
    const children =
      typeof job.action.actor === "string"
        ? [job.action.actor]
        : job.action.actor;
    for (const child of children)
      objectMotions.push(
        compileAttach({
          child,
          bone: job.action.bone,
          parentTransform: parentNode.transform,
          parentSkeleton: parentRig,
          parentMotion: motions[job.action.parent],
          start: job.action.start,
          duration: end - job.action.start,
          shotDuration: performance.duration,
          jointAxes: HUMANOID_JOINT_AXES,
        }),
      );
  }

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
      duration: performance.duration,
    },
    motions,
  };
};
