import {
  IAutoFilmActionCall,
  IAutoFilmConstraintViolation,
  IAutoFilmMotion,
  IAutoFilmPerformanceApplication,
  IAutoFilmScriptApplication,
  IAutoFilmShot,
  IAutoFilmSkeleton,
} from "@autofilm/interface";

import {
  IAutoFilmActionSynthesizer,
  compilePerformance,
} from "../perform/compilePerformance";
import { validateMotion } from "../validation/validateMotion";
import { ViolationCollector } from "../validation/violation";
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
 * Camera `frame` actions pick the live camera rather than compile motion: the
 * first one names the shot's camera (staging aimed it already), and rival
 * `frame` calls on a second camera are a violation — one take, one live camera.
 * A shot with no `frame` call falls back to the scene's first camera; a scene
 * with no cameras at all cannot be framed and fails. `cameraMotion` stays null
 * for now — compiling a `frame` move into a camera clip is its own pipeline
 * rung (see `.wiki/06-architecture/film-pipeline.md`).
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
}): IAutoFilmPerformedShot => {
  const { script, staged, performance, synthesize, skeleton } = props;
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

  let liveCamera: string | null = null;
  const stageActions: IAutoFilmActionCall[] = [];
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
    } else stageActions.push(action);
  });

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

  return {
    success: true,
    shot: {
      id: `shot:${performance.beat}`,
      name: beat!.name,
      scene: staged.scene.id,
      camera: liveCamera!,
      cameraMotion: null,
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
