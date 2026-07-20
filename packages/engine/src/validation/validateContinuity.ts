import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  IResolveBeatProps,
  resolveBeatEnd,
  resolveBeatOpening,
} from "../film/resolveBeatEnd";
import { Vector3 } from "../math/Vector3";
import { ViolationCollector } from "./violation";

/** Default world-space position drift tolerated across a cut (metres). */
const DEFAULT_POSITION_TOLERANCE = 0.05;

/** Default facing drift tolerated across a cut (degrees). */
const DEFAULT_FACING_TOLERANCE_DEG = 5;

/** The two tolerances a continuity comparison reads, once validated. */
interface ITolerances {
  position: number;
  facingDeg: number;
}

/**
 * Validate one cut boundary: the incoming beat's OPENING state against the
 * previous beat's recorded END state. This is the check the forward-written
 * {@link IAutoMovieBeatEndState} always implied but nothing performed: a cut
 * that fails to resume where the prior beat left off is the README's named
 * failure ("characters drift, props disappear").
 *
 * Drift is **advisory** (a `warning`, never a gate): a hard cut can
 * legitimately jump an actor to a new mark, a time-skip, or a new blocking. The
 * linter surfaces the drift with the exact actor, offset, and tolerance so the
 * author decides whether the cut intends it. It does not refuse the film. This
 * mirrors the physical-plausibility advisory tier.
 *
 * Per actor present at the prior beat's end:
 *
 * - World position drift beyond `positionTolerance` metres.
 * - Facing drift beyond `facingToleranceDeg` degrees.
 * - A persistent mount dropped or changed (the rider's horse vanished).
 * - The actor missing entirely from the incoming opening.
 */
export const validateContinuity = (props: {
  /** The previous beat's resolved end-state. */
  previous: IAutoMovieBeatEndState;

  /** The incoming beat's resolved opening-state. */
  opening: IAutoMovieBeatEndState;

  /** World-space position drift tolerated (metres); defaults to 0.05. */
  positionTolerance?: number;

  /** Facing drift tolerated (degrees); defaults to 5. */
  facingToleranceDeg?: number;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const tolerances = readTolerances(
    props.positionTolerance,
    props.facingToleranceDeg,
    "$input",
    collector,
  );
  if (tolerances === null) return collector.toValidation();
  compareBoundary(
    props.previous,
    props.opening,
    "$input",
    tolerances,
    collector,
  );
  return collector.toValidation();
};

/**
 * Walk a whole film in playback order and lint every cut boundary: resolve each
 * beat's end and opening snapshots, then compare each beat's opening against
 * the previous beat's end. The single-beat pairwise check is
 * {@link validateContinuity}; this is the film-level linter issue #1172 asks
 * for.
 *
 * The beats are the ordered {@link IResolveBeatProps} the pipeline already
 * builds for {@link resolveBeatEnd} (scene, shot, motions, mounts, plants). A
 * film of zero or one beat has no cut to lint and passes trivially.
 */
export const validateFilmContinuity = (props: {
  /** The film's beats, in playback order. */
  beats: readonly IResolveBeatProps[];

  /** World-space position drift tolerated (metres); defaults to 0.05. */
  positionTolerance?: number;

  /** Facing drift tolerated (degrees); defaults to 5. */
  facingToleranceDeg?: number;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const tolerances = readTolerances(
    props.positionTolerance,
    props.facingToleranceDeg,
    "$input",
    collector,
  );
  if (tolerances === null) return collector.toValidation();

  const snapshots = props.beats.map((beat) => ({
    end: resolveBeatEnd(beat),
    opening: resolveBeatOpening(beat),
  }));
  for (let i = 1; i < snapshots.length; ++i)
    compareBoundary(
      snapshots[i - 1]!.end,
      snapshots[i]!.opening,
      `$input.beats[${i}]`,
      tolerances,
      collector,
    );
  return collector.toValidation();
};

/**
 * Validate and default the two tolerances. Returns `null` (after pushing range
 * violations) when either is non-finite or out of its band, so the caller stops
 * before comparing against a nonsensical bar.
 */
const readTolerances = (
  position: number | undefined,
  facingDeg: number | undefined,
  root: string,
  collector: ViolationCollector,
): ITolerances | null => {
  const pos = position ?? DEFAULT_POSITION_TOLERANCE;
  const facing = facingDeg ?? DEFAULT_FACING_TOLERANCE_DEG;
  const badPos = !Number.isFinite(pos) || pos < 0;
  const badFacing = !Number.isFinite(facing) || facing < 0 || facing > 180;
  if (badPos)
    collector.push(
      "range",
      `${root}.positionTolerance`,
      "a finite position tolerance >= 0 metres",
      position,
    );
  if (badFacing)
    collector.push(
      "range",
      `${root}.facingToleranceDeg`,
      "a finite facing tolerance in [0, 180] degrees",
      facingDeg,
    );
  if (badPos || badFacing) return null;
  return { position: pos, facingDeg: facing };
};

/** Compare one incoming opening against the prior end, pushing drift warnings. */
const compareBoundary = (
  previous: IAutoMovieBeatEndState,
  opening: IAutoMovieBeatEndState,
  root: string,
  tolerances: ITolerances,
  collector: ViolationCollector,
): void => {
  const openingByNode = new Map(
    opening.actors.map((actor) => [actor.node, actor]),
  );
  previous.actors.forEach((prev) => {
    const open = openingByNode.get(prev.node);
    if (open === undefined) {
      collector.warn(
        "physics",
        `${root}.opening.actors`,
        `actor "${prev.node}" ended the previous beat but is absent from the incoming beat's opening: continuity cannot be verified`,
        prev.node,
      );
      return;
    }
    compareActor(
      prev,
      open,
      `${root}.opening.actors[node=${prev.node}]`,
      tolerances,
      collector,
    );
  });
};

/** Position, facing, and mount drift for one actor carried across a cut. */
const compareActor = (
  prev: IAutoMovieBeatEndActorState,
  open: IAutoMovieBeatEndActorState,
  path: string,
  tolerances: ITolerances,
  collector: ViolationCollector,
): void => {
  const drift = Vector3.length(
    Vector3.subtract(open.transform.translation, prev.transform.translation),
  );
  if (drift > tolerances.position)
    collector.warn(
      "physics",
      `${path}.transform.translation`,
      `resume within ${tolerances.position} m of where the previous beat ended`,
      open.transform.translation,
      drift - tolerances.position,
    );

  const facingDeg = angleBetweenDeg(prev.facing, open.facing);
  if (facingDeg > tolerances.facingDeg)
    collector.warn(
      "physics",
      `${path}.facing`,
      `resume within ${tolerances.facingDeg} deg of the previous beat's facing`,
      open.facing,
      facingDeg - tolerances.facingDeg,
    );

  if (prev.mount !== null && !sameMount(prev.mount, open.mount))
    collector.warn(
      "physics",
      `${path}.mount`,
      `keep riding "${prev.mount.parent}"'s "${prev.mount.bone}" the rider ended the previous beat mounted on`,
      open.mount,
    );
};

/**
 * Angle between two facing vectors in degrees; 0 when either is
 * degenerate-equal.
 */
const angleBetweenDeg = (
  a: IAutoMovieBeatEndActorState["facing"],
  b: IAutoMovieBeatEndActorState["facing"],
): number => {
  const dot = Vector3.dot(Vector3.normalize(a), Vector3.normalize(b));
  const clamped = Math.min(1, Math.max(-1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
};

/** Whether the incoming mount preserves the prior persistent coupling exactly. */
const sameMount = (
  prev: NonNullable<IAutoMovieBeatEndActorState["mount"]>,
  open: IAutoMovieBeatEndActorState["mount"],
): boolean =>
  open !== null && open.parent === prev.parent && open.bone === prev.bone;
