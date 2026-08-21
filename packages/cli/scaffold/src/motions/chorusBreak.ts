import type { IAutoMovieFormationMotion } from "@automovie/interface";

/**
 * Creates the reviewed uniform formation interval break.
 *
 * @evidence motions/030-chorus-break.md Implements this motion file and no
 *   other motion design.
 * @evidenceReview motions/030-chorus-break.md #36089c4 Read motions/030-chorus-break.md and createChorusBreakMotion in src/motions/chorusBreak.ts; confirmed this citation after checking the claim that implements this motion file and no other motion design.
 * @evidence motions/030-chorus-break.md#chorus-uniform-break Changes only the
 *   two spacing channels from one to the same explicit scale, selecting walk
 *   while documenting that zero root travel supplies no gait cadence.
 * @evidenceReview motions/030-chorus-break.md#chorus-uniform-break #fe40ad6 Read motions/030-chorus-break.md#chorus-uniform-break and createChorusBreakMotion in src/motions/chorusBreak.ts; confirmed this citation after checking the claim that changes only the two spacing channels from one to the same explicit scale, selecting walk while zero root travel supplies no gait cadence.
 * @evidence principles/motion-sources.md#design-owned-transition Implements
 *   only the cited endpoints, spatial relation, and ease-out path.
 * @evidenceReview principles/motion-sources.md#design-owned-transition #0815474 Read principles/motion-sources.md#design-owned-transition and createChorusBreakMotion in src/motions/chorusBreak.ts; confirmed this citation after checking the claim that implements only the cited endpoints, spatial relation, and ease-out path.
 * @evidence principles/motion-sources.md#pure-time-mapping Maps explicit
 *   identity, interval, and scale to one deterministic record.
 * @evidenceReview principles/motion-sources.md#pure-time-mapping #c0ea4a6 Read principles/motion-sources.md#pure-time-mapping and createChorusBreakMotion in src/motions/chorusBreak.ts; confirmed explicit identity, interval, and scale produce one deterministic time-addressed record while engine sampling stays outside the constructor.
 * @evidence principles/motion-sources.md#invalid-input-is-visible Rejects an
 *   empty identity, invalid interval, and non-expanding scale.
 * @evidenceReview principles/motion-sources.md#invalid-input-is-visible #ca43ce3 Read principles/motion-sources.md#invalid-input-is-visible and createChorusBreakMotion in src/motions/chorusBreak.ts; confirmed this citation after checking the claim that rejects an empty identity, invalid interval, and non-expanding scale.
 */
export function createChorusBreakMotion(props: {
  id: string;
  formation: string;
  start: number;
  end: number;
  scale: number;
}): IAutoMovieFormationMotion {
  if (props.id.length === 0 || props.formation.length === 0)
    throw new Error("CHORUS break ids must be non-empty.");
  if (
    !Number.isFinite(props.start) ||
    !Number.isFinite(props.end) ||
    props.start >= props.end
  )
    throw new Error("CHORUS break requires finite start < end seconds.");
  if (!Number.isFinite(props.scale) || props.scale <= 1)
    throw new Error("CHORUS break scale must be finite and greater than one.");
  return {
    id: props.id,
    formation: props.formation,
    action: "break",
    gait: "walk",
    start: props.start,
    end: props.end,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: props.scale, depth: props.scale },
    },
    easing: "easeOut",
  };
}
