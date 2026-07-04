import { CANONICAL_FACE_POSITIONS } from "./CanonicalFace";
import { IForgeMeshPart } from "./HairShell";

/** One eyeball: its mesh plus the fit the renderer colors the iris from. */
export interface IForgeEyeShell extends IForgeMeshPart {
  /** Eyeball center (xyz, meters). */
  center: [number, number, number];

  /** Eyeball radius (meters). */
  radius: number;
}

const RING_R = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];
const RING_L = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
  398,
];

const fitEye = (face: number[], ring: number[]): IForgeEyeShell => {
  const c: [number, number, number] = [0, 0, 0];
  for (const i of ring)
    for (let k = 0; k < 3; k++) c[k] += face[i * 3 + k]! / ring.length;
  let a = 0;
  for (const i of ring) a = Math.max(a, Math.abs(face[i * 3]! - c[0]));
  const radius = 1.15 * a;
  // front surface a hair proud of the lid plane, like a real cornea
  const cz = c[2] + 0.0008 - radius;
  const positions: number[] = [];
  const indices: number[] = [];
  const SEG = 24;
  const RING = 16;
  for (let r = 0; r <= RING; r++) {
    const phi = (Math.PI * r) / RING;
    for (let s = 0; s <= SEG; s++) {
      const th = (2 * Math.PI * s) / SEG;
      positions.push(
        c[0] + radius * Math.sin(phi) * Math.cos(th),
        c[1] + radius * Math.cos(phi),
        cz + radius * Math.sin(phi) * Math.sin(th),
      );
    }
  }
  const col = SEG + 1;
  for (let r = 0; r < RING; r++)
    for (let s = 0; s < SEG; s++) {
      const i0 = r * col + s;
      indices.push(i0, i0 + 1, i0 + col, i0 + 1, i0 + col + 1, i0 + col);
    }
  return { positions, indices, center: [c[0], c[1], cz + radius], radius };
};

/**
 * Eyeball spheres fitted to the eyelid rings — the piece that keeps a morphable
 * head from staring with empty sockets.
 *
 * Each sphere takes its center and radius from that eye's lid ring on the given
 * face (so it follows a morphed or identity-baked face), with the front surface
 * sitting a fraction of a millimeter proud of the lid plane the way a cornea
 * does. The returned `center` is the FRONT pole — the renderer colors
 * iris/pupil by angular distance from it.
 *
 * @author Samchon
 */
export const buildEyeShells = (
  face: number[] = CANONICAL_FACE_POSITIONS,
): { right: IForgeEyeShell; left: IForgeEyeShell } => ({
  right: fitEye(face, RING_R),
  left: fitEye(face, RING_L),
});
