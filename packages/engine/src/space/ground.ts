/**
 * Normalize a ground source — a plane scalar or an `(x, z) → y` heightfield —
 * into the height callback the motion and validation seams consume. The one
 * spot the scalar/callback duality is resolved, so `plantStanceFeet` and
 * `validateGroundContact` stay byte-compatible with their pre-space scalar
 * behavior while accepting a space via {@link spaceGround}.
 *
 * @author Samchon
 */
export const groundFunction = (
  ground: number | ((x: number, z: number) => number),
): ((x: number, z: number) => number) =>
  typeof ground === "number" ? (): number => ground : ground;
