import {
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieScriptApplication,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";
import { IAutoMovieStagedSet } from "./stageScene";

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
 * The BLOCKING consumer — gate one beat's shot plan before any performance is
 * compiled from it. The checks are coherence, not craft: the beat must be one
 * the script planned, every intent must belong to a placed actor, the camera
 * must favour something placed, and the timing anchors must sit on the beat's
 * own timeline **in the order they are listed** — the list order is the causal
 * order ("the loose before the hit"), so an anchor whose `t` runs backwards
 * contradicts the causality it exists to fix.
 */
export const blockBeat = (
  script: IAutoMovieScriptApplication.IWrite,
  staged: IAutoMovieStagedSet.ISuccess,
  blocking: IAutoMovieBlockingApplication.IWrite,
): IAutoMovieBlockedBeat => {
  const out = new ViolationCollector();

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(blocking.beat, "$input.beat", "beat id");

  if (!script.beats.some((b) => b.id === blocking.beat))
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
          `anchor "${anchor.cue}" (t=${anchor.t}) runs before its predecessor (t=${previous}) — the list order is the causal order`,
          anchor.t,
        );
      if (finiteAnchorTime) previous = anchor.t;
    });
  });

  if (
    blocking.camera.on.kind === "node" &&
    !nodeIds.has(blocking.camera.on.node)
  )
    out.push(
      "type",
      "$input.camera.on.node",
      `the camera must favour a placed actor, but "${blocking.camera.on.node}" is not staged`,
      blocking.camera.on.node,
    );
  if (blocking.camera.on.kind === "node")
    validateNonEmptyId(
      blocking.camera.on.node,
      "$input.camera.on.node",
      "camera target node id",
    );

  return out.items.length > 0
    ? { success: false, violations: out.items }
    : { success: true, blocking };
};
