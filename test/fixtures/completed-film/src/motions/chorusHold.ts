import type { IAutoMovieFormationMotion } from "@automovie/interface";

import { CHORUS_ADVANCE_METRES } from "./chorusAdvance";

/**
 * Creates the reviewed hold at the completed advance endpoint.
 *
 * @evidence motions/025-chorus-hold.md Solely owns the reviewed zero-travel
 *   interval at the completed 2 m formation endpoint.
 * @evidenceReview motions/025-chorus-hold.md #99bec22 Read motions/025-chorus-hold.md and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed that this function solely owns the reviewed zero-travel interval at the completed 2 m formation endpoint.
 * @evidence motions/025-chorus-hold.md#chorus-advanced-hold Repeats the exact
 *   2 m translated state with unit spacing and an explicit zero-travel walk
 *   gait across the supplied interval.
 * @evidenceReview motions/025-chorus-hold.md#chorus-advanced-hold #bea0013 Read motions/025-chorus-hold.md#chorus-advanced-hold and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed this citation after checking the claim that repeats the exact 2 m translated state with unit spacing and an explicit zero-travel walk gait across the supplied interval.
 * @evidence obligations/motion-sources.md#design-owned-transition Implements
 *   only the cited constant endpoints and linear phase.
 * @evidenceReview obligations/motion-sources.md#design-owned-transition #5d64f23 Read obligations/motion-sources.md#design-owned-transition and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed this citation after checking the claim that implements only the cited constant endpoints and linear phase.
 * @evidence obligations/motion-sources.md#pure-time-mapping Maps explicit
 *   identities and seconds to one deterministic held record.
 * @evidenceReview obligations/motion-sources.md#pure-time-mapping #3127ece Read obligations/motion-sources.md#pure-time-mapping and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed explicit identities and seconds produce one deterministic time-addressed held record while engine sampling stays outside the constructor.
 * @evidence obligations/motion-sources.md#invalid-input-is-visible Rejects an
 *   invalid identity or interval before repeating the advanced endpoint.
 * @evidenceReview obligations/motion-sources.md#invalid-input-is-visible #5ce63ab Read obligations/motion-sources.md#invalid-input-is-visible and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed that invalid identities and intervals fail before the function can repeat the advanced endpoint.
 */
export function createChorusHoldMotion(props: {
  id: string;
  formation: string;
  start: number;
  end: number;
}): IAutoMovieFormationMotion {
  if (props.id.length === 0 || props.formation.length === 0)
    throw new Error("CHORUS hold ids must be non-empty.");
  if (
    !Number.isFinite(props.start) ||
    !Number.isFinite(props.end) ||
    props.start >= props.end
  )
    throw new Error("CHORUS hold requires finite start < end seconds.");
  const held = {
    translation: { x: 0, y: 0, z: -CHORUS_ADVANCE_METRES },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  };
  return {
    id: props.id,
    formation: props.formation,
    action: "hold",
    gait: "walk",
    start: props.start,
    end: props.end,
    from: held,
    to: held,
    easing: "linear",
  };
}
