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
 * @evidence obligations/design/motion-sources.md#design-owned-transition Implements
 *   only the cited constant endpoints and linear phase.
 * @evidenceReview obligations/design/motion-sources.md#design-owned-transition #b1654c2 Read obligations/design/motion-sources.md#design-owned-transition and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed this citation after checking the claim that implements only the cited constant endpoints and linear phase.
 * @evidence obligations/design/motion-sources.md#pure-time-mapping Maps explicit
 *   identities and seconds to one deterministic held record.
 * @evidenceReview obligations/design/motion-sources.md#pure-time-mapping #c5946e5 Read obligations/design/motion-sources.md#pure-time-mapping and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed explicit identities and seconds produce one deterministic time-addressed held record while engine sampling stays outside the constructor.
 * @evidence obligations/design/motion-sources.md#invalid-input-is-visible Rejects an
 *   invalid identity or interval before repeating the advanced endpoint.
 * @evidenceReview obligations/design/motion-sources.md#invalid-input-is-visible #22a9708 Read obligations/design/motion-sources.md#invalid-input-is-visible and createChorusHoldMotion in src/motions/chorusHold.ts; confirmed that invalid identities and intervals fail before the function can repeat the advanced endpoint.
 * @evidence principles/core/source-units.md#source-scope-preservation createChorusHoldMotion keeps responsibility for Creates the reviewed hold at the completed advance endpoint in this declaration; the implementation fragment { if (props.id.length === 0 || props.formation.length === 0) throw new Error("CHORUS hold ids must be non-empty."); if ( !Number.isFinite(props.start) || introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete createChorusHoldMotion declaration and implementation with the reviewed chorusHold motion inputs, channels, limits, and terminal state; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion createChorusHoldMotion is a usable source artifact for Creates the reviewed hold at the completed advance endpoint; it is implemented directly as { if (props.id.length === 0 || props.formation.length === 0) throw new Error("CHORUS hold ids must be non-empty."); if ( !Number.isFinite(props.start) || rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable createChorusHoldMotion signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/motion-sources.md#design-revision-from-motion-source-work Implementing createChorusHoldMotion tested the reviewed chorusHold motion inputs, channels, limits, and terminal state through Creates the reviewed hold at the completed advance endpoint; the implementation fragment { if (props.id.length === 0 || props.formation.length === 0) throw new Error("CHORUS hold ids must be non-empty."); if ( !Number.isFinite(props.start) || shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/motion-sources.md#design-revision-from-motion-source-work #c743d16 I compared the complete createChorusHoldMotion implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
