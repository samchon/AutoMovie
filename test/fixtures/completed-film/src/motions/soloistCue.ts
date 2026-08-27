import type { IAutoMovieMotion } from "@automovie/interface";

/**
 * The authored cue endpoint in degrees of upper-arm abduction.
 *
 * @evidence motions/010-soloist-cue.md The cue design fixes 110 degrees as the
 *   one raised-hand endpoint shared by continuation shots and motion output.
 * @evidenceReview motions/010-soloist-cue.md #cb2950d Read motions/010-soloist-cue.md and SOLOIST_CUE_ABDUCTION in src/motions/soloistCue.ts; confirmed this citation after checking the claim that the cue design fixes 110 degrees as the one raised-hand endpoint shared by continuation shots and motion output.
 * @evidence motions/010-soloist-cue.md#soloist-raise-hold Exposes the reviewed
 *   endpoint without making a shot or subject class restate it.
 * @evidenceReview motions/010-soloist-cue.md#soloist-raise-hold #d61383a Read motions/010-soloist-cue.md#soloist-raise-hold and SOLOIST_CUE_ABDUCTION in src/motions/soloistCue.ts; confirmed this citation after checking the claim that exposes the reviewed endpoint without making a shot or subject class restate it.
 * @evidence obligations/motion-sources.md#design-owned-transition Carries the
 *   exact endpoint owned by the cited motion design.
 * @evidenceReview obligations/motion-sources.md#design-owned-transition #5d64f23 Read obligations/motion-sources.md#design-owned-transition and SOLOIST_CUE_ABDUCTION in src/motions/soloistCue.ts; confirmed this citation after checking the claim that carries the exact endpoint owned by the cited motion design.
 */
export const SOLOIST_CUE_ABDUCTION = 110;

const ARRIVAL_SECONDS = 2;

/**
 * Creates the reviewed neutral-to-raised transition and terminal hold.
 *
 * @evidence motions/010-soloist-cue.md Solely owns the reviewed left-arm
 *   raise to 110 degrees by 2 seconds and its terminal hold.
 * @evidenceReview motions/010-soloist-cue.md #cb2950d Read motions/010-soloist-cue.md and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed that this function solely owns the reviewed left-arm raise to 110 degrees by 2 seconds and its terminal hold.
 * @evidence motions/010-soloist-cue.md#soloist-raise-hold Maps the declared
 *   start abduction to 110 degrees by 2 seconds and then holds it.
 * @evidenceReview motions/010-soloist-cue.md#soloist-raise-hold #d61383a Read motions/010-soloist-cue.md#soloist-raise-hold and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed this citation after checking the claim that maps the declared start abduction to 110 degrees by 2 seconds and then holds it.
 * @evidence obligations/motion-sources.md#design-owned-transition Implements
 *   only the endpoints, phases, joints, and parameter domain the design owns.
 * @evidenceReview obligations/motion-sources.md#design-owned-transition #5d64f23 Read obligations/motion-sources.md#design-owned-transition and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed this citation after checking the claim that implements only the endpoints, phases, joints, and parameter domain the design owns.
 * @evidence obligations/motion-sources.md#pure-time-mapping Uses only explicit
 *   context, skeleton, duration, and start pose to emit deterministic keys.
 * @evidenceReview obligations/motion-sources.md#pure-time-mapping #3127ece Read obligations/motion-sources.md#pure-time-mapping and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed explicit context, skeleton, duration, and start pose produce one deterministic time-addressed key record while engine sampling stays outside the constructor.
 * @evidence obligations/motion-sources.md#invalid-input-is-visible Rejects
 *   invalid duration and abduction before they can produce an unauthorized
 *   motion record.
 * @evidenceReview obligations/motion-sources.md#invalid-input-is-visible #5ce63ab Read obligations/motion-sources.md#invalid-input-is-visible and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed this citation after checking the claim that rejects invalid duration and abduction before they can produce an unauthorized motion record.
 */
export function createSoloistCueMotion(props: {
  id: string;
  duration: number;
  skeleton: string;
  from: number;
}): IAutoMovieMotion {
  const duration = props.duration;
  if (props.id.length === 0 || props.skeleton.length === 0)
    throw new Error("SOLOIST cue ids must be non-empty.");
  if (!Number.isFinite(duration) || duration < ARRIVAL_SECONDS)
    throw new Error(
      `SOLOIST cue duration must be finite and at least ${ARRIVAL_SECONDS} seconds.`,
    );
  if (
    !Number.isFinite(props.from) ||
    props.from < 0 ||
    props.from > SOLOIST_CUE_ABDUCTION
  )
    throw new Error(
      `SOLOIST cue start abduction must be between 0 and ${SOLOIST_CUE_ABDUCTION} degrees.`,
    );

  const pose = (abduction: number) => ({
    skeleton: props.skeleton,
    root: null,
    joints: [
      {
        bone: "leftUpperArm" as const,
        flexion: null,
        abduction,
        twist: null,
      },
      {
        bone: "leftLowerArm" as const,
        flexion: 25,
        abduction: null,
        twist: null,
      },
    ],
  });
  const key = (
    time: number,
    abduction: number,
    easing: "linear" | "easeInOut",
  ) => ({
    time,
    pose: pose(abduction),
    expression: null,
    easing,
    bezier: null,
  });
  return {
    id: `${props.id}-cue`,
    skeleton: props.skeleton,
    duration,
    loop: false,
    keyframes:
      props.from === SOLOIST_CUE_ABDUCTION
        ? [key(0, props.from, "linear"), key(duration, props.from, "linear")]
        : [
            key(0, props.from, "easeInOut"),
            key(ARRIVAL_SECONDS, SOLOIST_CUE_ABDUCTION, "linear"),
            key(duration, SOLOIST_CUE_ABDUCTION, "linear"),
          ],
    gaitCycle: null,
  };
}
