import type { IAutoMovieFormationMotion } from "@automovie/interface";

/**
 * The settings-owned distance every reviewed chorus advance travels.
 *
 * @evidence motions/020-chorus-advance.md The motion design fixes the whole
 *   formation's forward displacement at 2 m.
 * @evidenceReview motions/020-chorus-advance.md #93ed66f Read motions/020-chorus-advance.md and CHORUS_ADVANCE_METRES in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that the motion design fixes the whole formation's forward displacement at 2 m.
 * @evidence motions/020-chorus-advance.md#chorus-ordered-advance Exposes the
 *   reviewed displacement to world containment and motion construction.
 * @evidenceReview motions/020-chorus-advance.md#chorus-ordered-advance #784d096 Read motions/020-chorus-advance.md#chorus-ordered-advance and CHORUS_ADVANCE_METRES in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that exposes the reviewed displacement to world containment and motion construction.
 * @evidence obligations/motion-sources.md#design-owned-transition Carries the
 *   exact displacement the cited motion design inherited from settings.
 * @evidenceReview obligations/motion-sources.md#design-owned-transition #5d64f23 Read obligations/motion-sources.md#design-owned-transition and CHORUS_ADVANCE_METRES in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that carries the exact displacement the cited motion design inherited from settings.
 */
export const CHORUS_ADVANCE_METRES = 2;

/**
 * Creates the reviewed ordered formation advance.
 *
 * @evidence motions/020-chorus-advance.md Solely owns the reviewed ordered
 *   2 m formation translation and its preserved spacing and facing channels.
 * @evidenceReview motions/020-chorus-advance.md #93ed66f Read motions/020-chorus-advance.md and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed that this function solely owns the reviewed ordered 2 m translation and preserves both spacing channels and facing.
 * @evidence motions/020-chorus-advance.md#chorus-ordered-advance Moves the
 *   formation 2 m forward with the reviewed walk gait while preserving facing
 *   and both spacing channels.
 * @evidenceReview motions/020-chorus-advance.md#chorus-ordered-advance #784d096 Read motions/020-chorus-advance.md#chorus-ordered-advance and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that moves the formation 2 m forward with the reviewed walk gait while preserving facing and both spacing channels.
 * @evidence obligations/motion-sources.md#design-owned-transition Implements
 *   only the cited advance endpoints and ease-in-out path.
 * @evidenceReview obligations/motion-sources.md#design-owned-transition #5d64f23 Read obligations/motion-sources.md#design-owned-transition and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that implements only the cited advance endpoints and ease-in-out path.
 * @evidence obligations/motion-sources.md#pure-time-mapping Maps explicit id,
 *   formation, start, and end values to one deterministic record.
 * @evidenceReview obligations/motion-sources.md#pure-time-mapping #3127ece Read obligations/motion-sources.md#pure-time-mapping and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed explicit id, formation, start, and end values produce one deterministic time-addressed record while engine sampling stays outside the constructor.
 * @evidence obligations/motion-sources.md#invalid-input-is-visible Rejects an
 *   invalid identity or interval before constructing a translated endpoint.
 * @evidenceReview obligations/motion-sources.md#invalid-input-is-visible #5ce63ab Read obligations/motion-sources.md#invalid-input-is-visible and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed that invalid identities and intervals fail before the function can construct a translated endpoint.
 */
export function createChorusAdvanceMotion(props: {
  id: string;
  formation: string;
  start: number;
  end: number;
}): IAutoMovieFormationMotion {
  validateInterval(props);
  const held = { lateral: 1, depth: 1 };
  return {
    id: props.id,
    formation: props.formation,
    action: "advance",
    gait: "walk",
    start: props.start,
    end: props.end,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: held,
    },
    to: {
      translation: { x: 0, y: 0, z: -CHORUS_ADVANCE_METRES },
      facingOffsetDeg: 0,
      spacingScale: held,
    },
    easing: "easeInOut",
  };
}

function validateInterval(props: {
  id: string;
  formation: string;
  start: number;
  end: number;
}): void {
  if (props.id.length === 0 || props.formation.length === 0)
    throw new Error("CHORUS advance ids must be non-empty.");
  if (
    !Number.isFinite(props.start) ||
    !Number.isFinite(props.end) ||
    props.start >= props.end
  )
    throw new Error("CHORUS advance requires finite start < end seconds.");
}
