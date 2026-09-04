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
 * @evidence obligations/design/motion-sources.md#design-owned-transition Carries the
 *   exact displacement the cited motion design inherited from settings.
 * @evidenceReview obligations/design/motion-sources.md#design-owned-transition #b1654c2 Read obligations/design/motion-sources.md#design-owned-transition and CHORUS_ADVANCE_METRES in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that carries the exact displacement the cited motion design inherited from settings.
 * @evidence principles/core/source-units.md#source-scope-preservation CHORUS_ADVANCE_METRES keeps responsibility for the exported CHORUS_ADVANCE_METRES source owner and its declared value or behavior in this declaration; the implementation fragment 2 introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete CHORUS_ADVANCE_METRES declaration and implementation with the reviewed chorusAdvance motion inputs, channels, limits, and terminal state; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion CHORUS_ADVANCE_METRES is a usable source artifact for the exported CHORUS_ADVANCE_METRES source owner and its declared value or behavior; it is implemented directly as 2 rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable CHORUS_ADVANCE_METRES signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/motion-sources.md#design-revision-from-motion-source-work Implementing CHORUS_ADVANCE_METRES tested the reviewed chorusAdvance motion inputs, channels, limits, and terminal state through the exported CHORUS_ADVANCE_METRES source owner and its declared value or behavior; the implementation fragment 2 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/motion-sources.md#design-revision-from-motion-source-work #c743d16 I compared the complete CHORUS_ADVANCE_METRES implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
 * @evidence obligations/design/motion-sources.md#design-owned-transition Implements
 *   only the cited advance endpoints and ease-in-out path.
 * @evidenceReview obligations/design/motion-sources.md#design-owned-transition #b1654c2 Read obligations/design/motion-sources.md#design-owned-transition and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed this citation after checking the claim that implements only the cited advance endpoints and ease-in-out path.
 * @evidence obligations/design/motion-sources.md#pure-time-mapping Maps explicit id,
 *   formation, start, and end values to one deterministic record.
 * @evidenceReview obligations/design/motion-sources.md#pure-time-mapping #c5946e5 Read obligations/design/motion-sources.md#pure-time-mapping and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed explicit id, formation, start, and end values produce one deterministic time-addressed record while engine sampling stays outside the constructor.
 * @evidence obligations/design/motion-sources.md#invalid-input-is-visible Rejects an
 *   invalid identity or interval before constructing a translated endpoint.
 * @evidenceReview obligations/design/motion-sources.md#invalid-input-is-visible #22a9708 Read obligations/design/motion-sources.md#invalid-input-is-visible and createChorusAdvanceMotion in src/motions/chorusAdvance.ts; confirmed that invalid identities and intervals fail before the function can construct a translated endpoint.
 * @evidence principles/core/source-units.md#source-scope-preservation createChorusAdvanceMotion keeps responsibility for Creates the reviewed ordered formation advance in this declaration; the implementation fragment { validateInterval(props); const held = { lateral: 1, depth: 1 }; return { id: props.id, formation: props.formation, action: "advance", gait: "walk", start: props.start, end introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete createChorusAdvanceMotion declaration and implementation with the reviewed chorusAdvance motion inputs, channels, limits, and terminal state; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion createChorusAdvanceMotion is a usable source artifact for Creates the reviewed ordered formation advance; it is implemented directly as { validateInterval(props); const held = { lateral: 1, depth: 1 }; return { id: props.id, formation: props.formation, action: "advance", gait: "walk", start: props.start, end rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable createChorusAdvanceMotion signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/motion-sources.md#design-revision-from-motion-source-work Implementing createChorusAdvanceMotion tested the reviewed chorusAdvance motion inputs, channels, limits, and terminal state through Creates the reviewed ordered formation advance; the implementation fragment { validateInterval(props); const held = { lateral: 1, depth: 1 }; return { id: props.id, formation: props.formation, action: "advance", gait: "walk", start: props.start, end shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/motion-sources.md#design-revision-from-motion-source-work #c743d16 I compared the complete createChorusAdvanceMotion implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
