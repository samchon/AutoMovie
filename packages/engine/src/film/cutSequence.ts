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
  const byId = new Map<string, { shot: IAutoMovieShot; index: number }>();
  shots.forEach((shot, index) => {
    const existing = byId.get(shot.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `$shots[${index}].id`,
        `shot id "${shot.id}" is duplicated; first declared at $shots[${existing.index}].id`,
        shot.id,
      );
      return;
    }
    byId.set(shot.id, { shot, index });
  });

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(assemble.sequence.id, "$input.sequence.id", "sequence id");

  if (!Number.isFinite(assemble.fps) || !(assemble.fps > 0))
    out.push(
      "range",
      "$input.fps",
      `frame rate must be a finite number > 0, but was ${assemble.fps}`,
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
  let previousPlayed: number | null = null;
  let previousIncomingTransition = 0;
  assemble.entries.forEach((entry, i) => {
    validateNonEmptyId(entry.shot, `$input.entries[${i}].shot`, "shot id");
    const found = byId.get(entry.shot);
    if (found === undefined) {
      out.push(
        "type",
        `$input.entries[${i}].shot`,
        `entry must reference a built shot, but "${entry.shot}" was never performed`,
        entry.shot,
      );
      previousPlayed = null;
      previousIncomingTransition = 0;
      return;
    }
    const { shot, index: shotIndex } = found;
    const validShotDuration =
      Number.isFinite(shot.duration) && shot.duration > 0;
    if (!validShotDuration)
      out.push(
        "range",
        `$shots[${shotIndex}].duration`,
        `referenced shot "${shot.id}" duration must be a finite number > 0 seconds, but was ${shot.duration}`,
        shot.duration,
      );
    let played = shot.duration;
    let validPlayedSpan = validShotDuration;
    let incomingTransition = 0;
    if (entry.trim !== null) {
      const { start, duration } = entry.trim;
      if (!Number.isFinite(duration) || !(duration > 0)) {
        validPlayedSpan = false;
        out.push(
          "range",
          `$input.entries[${i}].trim.duration`,
          `trim duration must be a finite number > 0 seconds, but was ${duration}`,
          duration,
        );
      } else if (!Number.isFinite(start)) {
        validPlayedSpan = false;
        out.push(
          "range",
          `$input.entries[${i}].trim.start`,
          `trim start must be a finite number >= 0 seconds, but was ${start}`,
          start,
        );
      } else if (
        validShotDuration &&
        (start < 0 || start + duration > shot.duration)
      ) {
        validPlayedSpan = false;
        out.push(
          "range",
          `$input.entries[${i}].trim`,
          `trim [${start}, ${start + duration}] must lie inside shot "${shot.id}" [0, ${shot.duration}]`,
          entry.trim,
          Math.max(-start, start + duration - shot.duration),
        );
      } else played = duration;
    }
    if (entry.transition !== null) {
      if (i === 0)
        out.push(
          "type",
          `$input.entries[0].transition`,
          "the first entry has nothing to transition from",
          entry.transition,
        );
      else if (
        !Number.isFinite(entry.transition.duration) ||
        !(entry.transition.duration > 0)
      )
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `transition duration must be a finite number > 0 seconds, but was ${entry.transition.duration}`,
          entry.transition.duration,
        );
      else if (validPlayedSpan && entry.transition.duration > played)
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `transition (${entry.transition.duration}s) must not outlast the entry's played span (${played}s)`,
          entry.transition.duration,
          entry.transition.duration - played,
        );
      else if (
        previousPlayed !== null &&
        entry.transition.duration > previousPlayed
      )
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `transition (${entry.transition.duration}s) must not outlast the previous entry's played span (${previousPlayed}s)`,
          entry.transition.duration,
          entry.transition.duration - previousPlayed,
        );
      else if (
        previousPlayed !== null &&
        previousIncomingTransition + entry.transition.duration > previousPlayed
      )
        out.push(
          "range",
          `$input.entries[${i}].transition.duration`,
          `adjacent transitions (${previousIncomingTransition}s + ${entry.transition.duration}s) must not overlap inside the previous entry's played span (${previousPlayed}s)`,
          entry.transition.duration,
          previousIncomingTransition +
            entry.transition.duration -
            previousPlayed,
        );
      else {
        runtime -= entry.transition.duration;
        incomingTransition = entry.transition.duration;
      }
    }
    runtime += played;
    previousPlayed = validPlayedSpan ? played : null;
    previousIncomingTransition = validPlayedSpan ? incomingTransition : 0;
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
