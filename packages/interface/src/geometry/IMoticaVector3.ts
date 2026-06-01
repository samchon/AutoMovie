/**
 * A 3D vector in motica space (y-up, right-handed — see the package README
 * coordinate convention).
 *
 * Used both for positions / translations (in meters) and for unitless
 * directions (axes, normals). Which one a given field means is documented at
 * that field; the engine range-checks positions where it matters.
 *
 * @author Samchon
 */
export interface IMoticaVector3 {
  /** X — toward the character's left (+) / right (−). */
  x: number;

  /** Y — up (+) / down (−). */
  y: number;

  /** Z — toward the character's front (+) / back (−). */
  z: number;
}
