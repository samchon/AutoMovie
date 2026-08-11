import {
  IAutoMovieConstraintViolation,
  IAutoMovieEditPlan,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * An assembled cut: the {@link IAutoMovieSequence} the ASSEMBLE stage edited, or
 * the contradictions that stopped it.
 *
 * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMovieCut supports ordered output-track composition: An assembled cut: the {@link IAutoMovieSequence} the ASSEMBLE stage edited, or the contradictions that stopped it.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut realizes ordered output-track composition: An assembled cut: the {@link IAutoMovieSequence} the ASSEMBLE stage edited, or the contradictions that stopped it.
 * @author Samchon
 */
export type IAutoMovieCut = IAutoMovieCut.ISuccess | IAutoMovieCut.IFailure;
export namespace IAutoMovieCut {
  /**
   * Every entry referenced a built shot and every trim fit inside it.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMovieCut.ISuccess supports ordered output-track composition: Every entry referenced a built shot and every trim fit inside it.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.ISuccess realizes ordered output-track composition: Every entry referenced a built shot and every trim fit inside it.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks The true discriminator identifies a fully resolved ordered cut that is safe to render.
     * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.ISuccess.success marks the ordered sequence and runtime as renderable.
     */
    success: true;

    /**
     * The cut-list, ready for the renderer.
     *
     * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMovieCut.ISuccess.sequence supports ordered output-track composition: The cut-list, ready for the renderer.
     * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.ISuccess.sequence realizes ordered output-track composition: The cut-list, ready for the renderer.
     */
    sequence: IAutoMovieSequence;

    /**
     * Total running time in seconds (trims applied, transitions overlap-free).
     *
     * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMovieCut.ISuccess.runtime supports ordered output-track composition: Total running time in seconds (trims applied, transitions overlap-free).
     * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.ISuccess.runtime realizes ordered output-track composition: Total running time in seconds (trims applied, transitions overlap-free).
     */
    runtime: number;
  }

  /**
   * The cut referenced a missing shot or trimmed outside one.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMovieCut.IFailure supports ordered output-track composition: The cut referenced a missing shot or trimmed outside one.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.IFailure realizes ordered output-track composition: The cut referenced a missing shot or trimmed outside one.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks The false discriminator prevents an unresolved edit list from becoming the renderer's track.
     * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.IFailure.success prevents an unresolved edit list from becoming an output track.
     */
    success: false;

    /**
     * Every violation found, for the correction round.
     *
     * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks Reports each missing shot, invalid trim, and incompatible transition at its edit-entry path.
     * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMovieCut.IFailure.violations realizes ordered output-track composition: Every violation found, for the correction round.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The ASSEMBLE consumer: fold the editor's cut-list into an
 * {@link IAutoMovieSequence} over the shots the pipeline actually built. The
 * gates are editorial physics: every entry must name a built shot, a trim must
 * select a positive span that lies inside its shot, a transition must not
 * outlast the incoming shot's played span, and the film must play at a positive
 * frame rate. Pacing and continuity stay prose. They have no cheap
 * deterministic verifier, so the schema carries the rationale instead.
 *
 * `runtime` sums each entry's played span (its trim's duration, else the whole
 * shot); transitions overlap the previous entry's tail, so each transition
 * subtracts its duration from the straight sum.
 *
 * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks Validates shot references, trims, and transitions before folding the ordered edit entries into one explicit runtime.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-ranges Keeps every played picture entry as a positive source start-and-duration span and refuses a trim that falls outside its referenced shot.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-transforms Preserves the supported unit-rate affine subset: an optional source trim followed by ordered film placement, with no claim to scale, reverse, hold, or nested transforms.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid Validates one finite positive film `fps` and carries it onto the assembled sequence; it does not claim that authored edit times lie on integer frames.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-refusal Rejects non-finite rate, non-positive or overflowing trim spans, invalid shot durations, and impossible transition durations without dropping the bad entry into a partial success.
 * @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-refusal Rejects a trim with a non-finite, non-positive, or source-overflowing range and reports its exact edit-entry path.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-story-film-order Uses the authored edit-entry order as film presentation order while retaining each referenced shot identity, without rewriting the shots' source order.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-source-preservation Builds sequence entries from shot references plus trim and transition metadata and leaves the performed source shots unchanged.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-authored-cut Copies the approved entry order, trims, and picture transitions into the sequence without optimizing pacing or film grammar.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-duration-closure Closes picture runtime by summing whole or trimmed shot spans and subtracting validated transition overlaps; it makes no sound, marker, effect, or tail-duration claim.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-missing-refusal Refuses an empty edit plan or an entry whose performed shot is absent instead of treating input order, filenames, or prior output as a finished timeline.
 * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-composition-refusal Refuses duplicate source-shot identity, an empty primary picture sequence, missing references, invalid picture spans, and unsupported adjacent transition overlap before marking the sequential cut successful.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-timing Treats each transition duration as an incoming overlap, subtracting it once from picture runtime only after both adjacent played spans can contain it.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-boundary-samples Preserves a validated positive overlap on the incoming sequence entry, fixing its picture boundary against the previous and current played spans without claiming a blend-curve sampler.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-refusal Rejects a first-entry, non-finite, non-positive, overlong, or mutually overlapping adjacent transition rather than silently replacing it with a hard cut.
 * @evidence requirements/editorial/validation.md#editorial-structural-validation Emits located violations for duplicate shot ids, missing references, invalid durations and trims, empty picture composition, and incompatible transition spans before returning failure.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition cutSequence realizes ordered output-track composition: The ASSEMBLE consumer: fold the editor's cut-list into an {@link IAutoMovieSequence} over the shots the pipeline actually built. The gates are editorial physics: every entry must name a built shot, a trim must select a positive span that lies inside its shot, a transition must not outlast the incoming shot's played span, and the film must play at a positive frame rate. Pacing and continuity stay prose. They have no cheap deterministic verifier, so the schema carries the rationale instead. `runtime` sums each entry's played span (its trim's duration, else the whole shot); transitions overlap the previous entry's tail, so each transition subtracts its duration from the straight sum.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Validates positive source spans and film rate, preserves the unit-rate trim-plus-offset transform, and rejects invalid temporal inputs without asserting integer-frame membership.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-clip-boundaries Validates the supported picture trim against its source-shot duration before carrying the boundary into the cut.
 * @evidence specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-film-identity Preserves authored shot references and edit order and derives picture-plus-transition closure without claiming sound or full conform closure.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Validates each incoming picture overlap against both adjacent played spans and retains its duration for downstream boundary evaluation.
 * @evidence specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-validation-recovery Returns stable located structural violations instead of publishing an invalid sequential picture composition as a successful cut.
 */
export const cutSequence = (
  assemble: IAutoMovieEditPlan,
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
