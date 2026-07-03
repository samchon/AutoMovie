import {
  IAutoFilmActionCall,
  IAutoFilmBlockingApplication,
  IAutoFilmCameraAction,
  IAutoFilmConstraintViolation,
  IAutoFilmMotion,
  IAutoFilmPerformanceApplication,
  IAutoFilmScriptApplication,
  IAutoFilmShot,
  IAutoFilmSkeleton,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";
import {
  IAutoFilmActionSynthesizer,
  compilePerformance,
} from "../perform/compilePerformance";
import { resolveTargetPoint } from "../perform/resolveTargetPoint";
import { validateMotion } from "../validation/validateMotion";
import { ViolationCollector } from "../validation/violation";
import {
  DEFAULT_SUBJECT_HEIGHT,
  IAutoFilmCameraFrameEntry,
  compileCameraMove,
  computeRestHeight,
} from "./cameraMove";
import { IAutoFilmStagedSet } from "./stageScene";

/**
 * A performed shot: the assembled {@link IAutoFilmShot} plus the dense motion
 * clips the compiler synthesised for it. The clips travel alongside the shot
 * because the shot references them by id — the host registers them wherever its
 * clip store lives.
 *
 * @author Samchon
 */
export type IAutoFilmPerformedShot =
  | IAutoFilmPerformedShot.ISuccess
  | IAutoFilmPerformedShot.IFailure;
export namespace IAutoFilmPerformedShot {
  /** The performance compiled and every clip passed validation. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The shot, ready for the cut. */
    shot: IAutoFilmShot;

    /** The synthesised per-actor clips, keyed by scene-node id. */
    motions: Record<string, IAutoFilmMotion>;
  }

  /** The action list contradicted the stage, or a compiled clip broke ROM. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoFilmConstraintViolation[];
  }
}

/**
 * The PERFORMANCE consumer — fold one beat's action calls into an
 * {@link IAutoFilmShot} through {@link compilePerformance}, gating both sides of
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
 * @param props.skeleton Rig lookup for ROM validation; return null for a node
 *   that has no skeleton (its clip skips ROM).
 */
export const performShot = (props: {
  script: IAutoFilmScriptApplication.IWrite;
  staged: IAutoFilmStagedSet.ISuccess;
  performance: IAutoFilmPerformanceApplication.IWrite;
  synthesize: IAutoFilmActionSynthesizer;
  skeleton: (node: string) => IAutoFilmSkeleton | null;
  /**
   * The beat's validated blocking (from `blockBeat`), when the pipeline runs
   * the full stage ladder. Supplying it arms the coherence gates between intent
   * and realization: matching beat and duration, every timing anchor covered by
   * an action of its actor, and the camera intent honoured.
   */
  blocking?: IAutoFilmBlockingApplication.IWrite;
}): IAutoFilmPerformedShot => {
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

  const nodePositions = new Map<string, IAutoFilmVector3>(
    staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
  );

  let liveCamera: string | null = null;
  const stageActions: IAutoFilmActionCall[] = [];
  const frames: { action: IAutoFilmCameraAction; index: number }[] = [];
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
    } else stageActions.push(action);
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

    const spanOf = (action: IAutoFilmActionCall): [number, number] => [
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

  // Compile the live camera's move from its frame actions. Subjects resolve
  // against the staged placements; a node subject's height is measured from
  // its rig's rest pose (staging doctrine: measure, don't hope), and its
  // animated base rides the compiled clip's root displacement so `follow`
  // tracks a walking actor.
  const cameraObject = staged.scene.cameras.find((c) => c.id === liveCamera)!;
  const entries: IAutoFilmCameraFrameEntry[] = frames.map(({ action }) => {
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
        at:
          motion === undefined
            ? null
            : (seconds: number) =>
                Vector3.add(
                  point,
                  sampleMotion(motion, seconds).pose.root?.translation ?? {
                    x: 0,
                    y: 0,
                    z: 0,
                  },
                ),
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
      duration: performance.duration,
    },
    motions,
  };
};
