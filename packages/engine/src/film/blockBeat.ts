import {
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieScriptApplication,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";
import { IAutoMovieStagedSet } from "./stageScene";

/** The closed framing union, gated at runtime the way performShot gates it. */
const CAMERA_FRAMINGS = new Set<
  IAutoMovieBlockingApplication.ICameraIntent["framing"]
>(["wide", "full", "medium", "close"]);

/** The closed move union, gated at runtime the way performShot gates it. */
const CAMERA_MOVES = new Set<
  IAutoMovieBlockingApplication.ICameraIntent["move"]
>(["static", "follow", "orbit", "push-in", "whip"]);

/**
 * A validated blocking: the beat's shot plan, coherent with the script and the
 * staged world, ready to steer the performance stage.
 *
 * @author Samchon
 */
export type IAutoMovieBlockedBeat =
  | IAutoMovieBlockedBeat.ISuccess
  | IAutoMovieBlockedBeat.IFailure;
export namespace IAutoMovieBlockedBeat {
  /** The plan holds together; performance can align to it. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The validated plan, verbatim. */
    blocking: IAutoMovieBlockingApplication.IWrite;

    /**
     * The validated initial condition from the prior beat, or `null` for the
     * first beat (or when none was supplied). Surfaced so the performance stage
     * can seed each actor's start position, facing, gait phase, velocity,
     * plants, and mount from where the previous beat actually ended; full
     * seeding into the action synthesizer is a follow-up.
     */
    previous: IAutoMovieBeatEndState | null;
  }

  /** The plan contradicted the script, the stage, or its own timeline. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every contradiction found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The BLOCKING consumer: gate one beat's shot plan before any performance is
 * compiled from it. The checks are coherence, not craft: the beat must be one
 * the script planned, every intent must belong to a placed actor, the camera
 * must favour something placed (an actor, a set piece, or another camera, the
 * same table `performShot` resolves against), and the timing anchors must sit
 * on the beat's own timeline **in the order they are listed**. The list order
 * is the causal order ("the loose before the hit"), so an anchor whose `t` runs
 * backwards contradicts the causality it exists to fix. The optional `coverage`
 * cameras (#1187) are gated the same way, plus their own rules: each must name
 * a staged camera exactly once and state a real framing/move.
 *
 * When the prior beat's end-state is supplied it becomes this beat's initial
 * condition: its actors are gated for referential integrity (every carried
 * actor must be a staged scene node, exactly once) and the validated state is
 * surfaced on the success so downstream stages resume from it rather than
 * resetting the world at the cut.
 */
export const blockBeat = (
  script: IAutoMovieScriptApplication.IWrite,
  staged: IAutoMovieStagedSet.ISuccess,
  blocking: IAutoMovieBlockingApplication.IWrite,
  previous?: IAutoMovieBeatEndState,
): IAutoMovieBlockedBeat => {
  const out = new ViolationCollector();
  const beatIds = new Map<string, number>();
  script.beats.forEach((beat, index) => {
    const existing = beatIds.get(beat.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `$script.beats[${index}].id`,
        `script beat id "${beat.id}" is duplicated; first declared at $script.beats[${existing}].id`,
        beat.id,
      );
      return;
    }
    beatIds.set(beat.id, index);
  });

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(blocking.beat, "$input.beat", "beat id");

  if (!beatIds.has(blocking.beat))
    out.push(
      "type",
      "$input.beat",
      `beat "${blocking.beat}" must be one of the script's beats`,
      blocking.beat,
    );

  if (!Number.isFinite(blocking.duration) || !(blocking.duration > 0))
    out.push(
      "range",
      "$input.duration",
      `beat duration must be a finite number > 0 seconds, but was ${blocking.duration}`,
      blocking.duration,
    );

  const nodeIds = new Set(staged.scene.nodes.map((n) => n.id));
  blocking.actors.forEach((intent, i) => {
    validateNonEmptyId(
      intent.node,
      `$input.actors[${i}].node`,
      "actor node id",
    );
    if (!nodeIds.has(intent.node))
      out.push(
        "type",
        `$input.actors[${i}].node`,
        `intent must belong to a staged actor, but "${intent.node}" is not placed`,
        intent.node,
      );
    let previous = -Infinity;
    (intent.anchors ?? []).forEach((anchor, j) => {
      const finiteAnchorTime = Number.isFinite(anchor.t);
      if (!finiteAnchorTime || anchor.t < 0 || anchor.t > blocking.duration)
        out.push(
          "range",
          `$input.actors[${i}].anchors[${j}].t`,
          `anchor "${anchor.cue}" must land within [0, ${blocking.duration}] (the beat), but was ${anchor.t}`,
          anchor.t,
        );
      if (finiteAnchorTime && anchor.t < previous)
        out.push(
          "range",
          `$input.actors[${i}].anchors[${j}].t`,
          `anchor "${anchor.cue}" (t=${anchor.t}) runs before its predecessor (t=${previous}): the list order is the causal order`,
          anchor.t,
        );
      if (finiteAnchorTime) previous = anchor.t;
    });
  });

  // What a camera intent may favour: any staged placement, an actor, a set
  // piece, or another camera. This is the SAME table `performShot` resolves a
  // positional target against (#1294); a plan the performance stage would
  // happily realize must not be refused one rung earlier, or "camera A frames
  // camera B" becomes a beat that can be performed but never blocked.
  const cameraIds = new Set(staged.scene.cameras.map((c) => c.id));
  const placedIds = new Set([...cameraIds, ...nodeIds]);

  if (
    blocking.camera.on.kind === "node" &&
    !placedIds.has(blocking.camera.on.node)
  )
    out.push(
      "type",
      "$input.camera.on.node",
      `the camera must favour something staged (an actor, a set piece, or another camera), but "${blocking.camera.on.node}" is not placed`,
      blocking.camera.on.node,
    );
  if (blocking.camera.on.kind === "node")
    validateNonEmptyId(
      blocking.camera.on.node,
      "$input.camera.on.node",
      "camera target node id",
    );

  // Additional cameras covering the beat (#1187). Each names its own staged
  // camera (one angle never blurs into another), favours something placed, and
  // states a real framing/move: unlike the hero intent, coverage has no
  // downstream coherence gate to catch a garbage value, so the closed unions
  // are gated here, the way performShot gates frame actions.
  const covered = new Map<string, number>();
  (blocking.coverage ?? []).forEach((intent, i) => {
    validateNonEmptyId(
      intent.camera,
      `$input.coverage[${i}].camera`,
      "coverage camera id",
    );
    if (!cameraIds.has(intent.camera))
      out.push(
        "type",
        `$input.coverage[${i}].camera`,
        `a coverage camera must be a staged camera, but "${intent.camera}" is not`,
        intent.camera,
      );
    const first = covered.get(intent.camera);
    if (first !== undefined)
      out.push(
        "type",
        `$input.coverage[${i}].camera`,
        `coverage camera id "${intent.camera}" is duplicated; first declared at $input.coverage[${first}].camera`,
        intent.camera,
      );
    else covered.set(intent.camera, i);
    if (!CAMERA_FRAMINGS.has(intent.framing))
      out.push(
        "type",
        `$input.coverage[${i}].framing`,
        `camera framing must be one of wide, full, medium, close, but was "${String(intent.framing)}"`,
        intent.framing,
      );
    if (!CAMERA_MOVES.has(intent.move))
      out.push(
        "type",
        `$input.coverage[${i}].move`,
        `camera move must be one of static, follow, orbit, push-in, whip, but was "${String(intent.move)}"`,
        intent.move,
      );
    if (intent.on.kind === "node" && !placedIds.has(intent.on.node))
      out.push(
        "type",
        `$input.coverage[${i}].on.node`,
        `a coverage camera must favour something staged (an actor, a set piece, or another camera), but "${intent.on.node}" is not placed`,
        intent.on.node,
      );
    if (intent.on.kind === "node")
      validateNonEmptyId(
        intent.on.node,
        `$input.coverage[${i}].on.node`,
        "coverage target node id",
      );
  });

  if (previous !== undefined) {
    const carried = new Map<string, number>();
    previous.actors.forEach((actor, i) => {
      validateNonEmptyId(
        actor.node,
        `$previous.actors[${i}].node`,
        "previous beat-end actor node id",
      );
      const first = carried.get(actor.node);
      if (first !== undefined)
        out.push(
          "type",
          `$previous.actors[${i}].node`,
          `previous beat-end actor "${actor.node}" is duplicated; first declared at $previous.actors[${first}].node`,
          actor.node,
        );
      else carried.set(actor.node, i);
      if (!nodeIds.has(actor.node))
        out.push(
          "type",
          `$previous.actors[${i}].node`,
          `previous beat-end actor "${actor.node}" is not a staged scene node: a carried state must resume placed actors`,
          actor.node,
        );
    });
  }

  return out.items.length > 0
    ? { success: false, violations: out.items }
    : { success: true, blocking, previous: previous ?? null };
};
