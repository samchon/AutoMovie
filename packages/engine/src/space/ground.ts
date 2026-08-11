/**
 * Normalize a ground source (a plane scalar or an `(x, z) → y` heightfield)
 * into the height callback the motion and validation seams consume. The one
 * spot the scalar/callback duality is resolved, so `plantStanceFeet` and
 * `validateGroundContact` stay byte-compatible with their pre-space scalar
 * behavior while accepting a space via {@link spaceGround}.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `groundFunction` normalizes a plane scalar or `(x, z) → y` heightfield into the height callback consumed by motion and validation. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `groundFunction` adapts either a constant plane or a spatial heightfield to one host-relative ground query.
 * @author Samchon
 */
export const groundFunction = (
  ground: number | ((x: number, z: number) => number),
): ((x: number, z: number) => number) =>
  typeof ground === "number" ? (): number => ground : ground;
