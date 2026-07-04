import {
  IAutoMovieAssembleApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * An assembled cut: the {@link IAutoMovieSequence} the ASSEMBLE stage edited, or
 * the contradictions that stopped it.
 *
 * @author Samchon
 */
export type IAutoMovieCut = IAutoMovieCut.ISuccess | IAutoMovieCut.IFailure;
export namespace IAutoMovieCut {
  /** Every entry referenced a built shot and every trim fit inside it. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The cut-list, ready for the renderer. */
    sequence: IAutoMovieSequence;

    /** Total running time in seconds (trims applied, transitions overlap-free). */
    runtime: number;
  }

  /** The cut referenced a missing shot or trimmed outside one. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The ASSEMBLE consumer — fold the editor's cut-list into an
 * {@link IAutoMovieSequence} over the shots the pipeline actually built. The
 * gates are editorial physics: every entry must name a built shot, a trim must
 * select a positive span that lies inside its shot, a transition must not
 * outlast the incoming shot's played span, and the film must play at a positive
 * frame rate. Pacing and continuity stay prose — they have no cheap
 * deterministic verifier, so the schema carries the rationale instead.
 *
 * `runtime` sums each entry's played span (its trim's duration, else the whole
 * shot); transitions overlap the previous entry's tail, so each transition
 * subtracts its duration from the straight sum.
 */
export const cutSequence = (
  assemble: IAutoMovieAssembleApplication.IWrite,
  shots: IAutoMovieShot[],
): IAutoMovieCut => {
  const out = new ViolationCollector();
  const byId = new Map(shots.map((s) => [s.id, s]));

  if (!(assemble.fps > 0))
    out.push(
      "range",
      "$input.fps",
      `frame rate must be > 0, but was ${assemble.fps}`,
      assemble.fps,
    );
  if (assemble.entries.length === 0)
    out.push(
      "type",
      "$input.entries",
      "a film must contain at least one shot",
      assemble.entries,
    );

  let runtime = 0;
  assemble.entries.forEach((entry, i) => {
    const shot = byId.get(entry.shot);
    if (shot === undefined) {
      out.push(
        "type",
        `$input.entries[${i}].shot`,
        `entry must reference a built shot, but "${entry.shot}" was never performed`,
        entry.shot,
      );
      return;
    }
    let played = shot.duration;
    if (entry.trim !== null) {
      const { start, duration } = entry.trim;
      if (!(duration > 0))
        out.push(
          "range",
          `$input.entries[${i}].trim.duration`,
          `trim duration must be > 0 seconds, but was ${duration}`,
          duration,
        );
      else if (start < 0 || start + duration > shot.duration)
        out.push(
          "range",
          `$input.entries[${i}].trim`,
          `trim [${start}, ${start + duration}] must lie inside shot "${shot.id}" [0, ${shot.duration}]`,
          entry.trim,
          Math.max(-start, start + duration - shot.duration),
        );
      else played = duration;
    }
    if (entry.transition !== null) {
      if (i === 0)
        out.push(
          "type",
          `$input.entries[0].transition`,
          "the first entry has nothing to transition from",
          entry.transition,
        );
      else if (!(entry.transition.duration > 0))
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `transition duration must be > 0 seconds, but was ${entry.transition.duration}`,
          entry.transition.duration,
        );
      else if (entry.transition.duration > played)
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `transition (${entry.transition.duration}s) must not outlast the entry's played span (${played}s)`,
          entry.transition.duration,
          entry.transition.duration - played,
        );
      else runtime -= entry.transition.duration;
    }
    runtime += played;
  });

  if (out.items.length > 0) return { success: false, violations: out.items };

  return {
    success: true,
    sequence: {
      id: assemble.sequence.id,
      name: assemble.sequence.name,
      shots: assemble.entries.map((entry) => ({
        shot: entry.shot,
        trim: entry.trim,
        transition: entry.transition,
      })),
      fps: assemble.fps,
    },
    runtime,
  };
};
