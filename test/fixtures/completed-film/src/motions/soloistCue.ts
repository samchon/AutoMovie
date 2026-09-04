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
 * @evidence obligations/design/motion-sources.md#design-owned-transition Carries the
 *   exact endpoint owned by the cited motion design.
 * @evidenceReview obligations/design/motion-sources.md#design-owned-transition #b1654c2 Read obligations/design/motion-sources.md#design-owned-transition and SOLOIST_CUE_ABDUCTION in src/motions/soloistCue.ts; confirmed this citation after checking the claim that carries the exact endpoint owned by the cited motion design.
 * @evidence principles/core/source-units.md#source-scope-preservation SOLOIST_CUE_ABDUCTION keeps responsibility for the exported SOLOIST_CUE_ABDUCTION source owner and its declared value or behavior in this declaration; the implementation fragment 110 introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete SOLOIST_CUE_ABDUCTION declaration and implementation with the reviewed soloistCue motion inputs, channels, limits, and terminal state; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion SOLOIST_CUE_ABDUCTION is a usable source artifact for the exported SOLOIST_CUE_ABDUCTION source owner and its declared value or behavior; it is implemented directly as 110 rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable SOLOIST_CUE_ABDUCTION signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/motion-sources.md#design-revision-from-motion-source-work Implementing SOLOIST_CUE_ABDUCTION tested the reviewed soloistCue motion inputs, channels, limits, and terminal state through the exported SOLOIST_CUE_ABDUCTION source owner and its declared value or behavior; the implementation fragment 110 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/motion-sources.md#design-revision-from-motion-source-work #c743d16 I compared the complete SOLOIST_CUE_ABDUCTION implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
 * @evidence obligations/design/motion-sources.md#design-owned-transition Implements
 *   only the endpoints, phases, joints, and parameter domain the design owns.
 * @evidenceReview obligations/design/motion-sources.md#design-owned-transition #b1654c2 Read obligations/design/motion-sources.md#design-owned-transition and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed this citation after checking the claim that implements only the endpoints, phases, joints, and parameter domain the design owns.
 * @evidence obligations/design/motion-sources.md#pure-time-mapping Uses only explicit
 *   context, skeleton, duration, and start pose to emit deterministic keys.
 * @evidenceReview obligations/design/motion-sources.md#pure-time-mapping #c5946e5 Read obligations/design/motion-sources.md#pure-time-mapping and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed explicit context, skeleton, duration, and start pose produce one deterministic time-addressed key record while engine sampling stays outside the constructor.
 * @evidence obligations/design/motion-sources.md#invalid-input-is-visible Rejects
 *   invalid duration and abduction before they can produce an unauthorized
 *   motion record.
 * @evidenceReview obligations/design/motion-sources.md#invalid-input-is-visible #22a9708 Read obligations/design/motion-sources.md#invalid-input-is-visible and createSoloistCueMotion in src/motions/soloistCue.ts; confirmed this citation after checking the claim that rejects invalid duration and abduction before they can produce an unauthorized motion record.
 * @evidence principles/core/source-units.md#source-scope-preservation createSoloistCueMotion keeps responsibility for Creates the reviewed neutral-to-raised transition and terminal hold in this declaration; the implementation fragment { const duration = props.duration; if (props.id.length === 0 || props.skeleton.length === 0) throw new Error("SOLOIST cue ids must be non-empty."); if introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete createSoloistCueMotion declaration and implementation with the reviewed soloistCue motion inputs, channels, limits, and terminal state; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion createSoloistCueMotion is a usable source artifact for Creates the reviewed neutral-to-raised transition and terminal hold; it is implemented directly as { const duration = props.duration; if (props.id.length === 0 || props.skeleton.length === 0) throw new Error("SOLOIST cue ids must be non-empty."); if rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable createSoloistCueMotion signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/motion-sources.md#design-revision-from-motion-source-work Implementing createSoloistCueMotion tested the reviewed soloistCue motion inputs, channels, limits, and terminal state through Creates the reviewed neutral-to-raised transition and terminal hold; the implementation fragment { const duration = props.duration; if (props.id.length === 0 || props.skeleton.length === 0) throw new Error("SOLOIST cue ids must be non-empty."); if shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/motion-sources.md#design-revision-from-motion-source-work #c743d16 I compared the complete createSoloistCueMotion implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
