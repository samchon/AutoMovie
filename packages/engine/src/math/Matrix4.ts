import { IautomovieQuaternion, IautomovieVector3 } from "@automovie/interface";

/**
 * Pure-function 4횞4 matrix math, column-major (glTF / `three.js` storage order:
 * element `m[col * 4 + row]`).
 *
 * The interface never exposes a matrix ??nodes carry decomposed TRS so every
 * value stays animatable ({@link IautomovieTransform}). But composing a hierarchy
 * _correctly_ under non-uniform scale needs a real matrix product (TRS-only
 * composition shears wrong when a scaled parent rotates a child), so the engine
 * drops to matrices internally for the compose pass and hands the renderer
 * world matrices. Every helper is stateless and returns a fresh `number[16]`.
 *
 * @author Samchon
 */
export namespace Matrix4 {
  /** The identity matrix. */
  export const identity = (): number[] => [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ];

  /**
   * Build the local transform matrix from a TRS triple, matching `three.js`
   * `Matrix4.compose` exactly (so engine and viewer agree bit-for-bit): `M = T
   * 쨌 R 쨌 S`.
   */
  export const compose = (
    t: IautomovieVector3,
    r: IautomovieQuaternion,
    s: IautomovieVector3,
  ): number[] => {
    const x2 = r.x + r.x;
    const y2 = r.y + r.y;
    const z2 = r.z + r.z;
    const xx = r.x * x2;
    const xy = r.x * y2;
    const xz = r.x * z2;
    const yy = r.y * y2;
    const yz = r.y * z2;
    const zz = r.z * z2;
    const wx = r.w * x2;
    const wy = r.w * y2;
    const wz = r.w * z2;
    return [
      (1 - (yy + zz)) * s.x,
      (xy + wz) * s.x,
      (xz - wy) * s.x,
      0,
      (xy - wz) * s.y,
      (1 - (xx + zz)) * s.y,
      (yz + wx) * s.y,
      0,
      (xz + wy) * s.z,
      (yz - wx) * s.z,
      (1 - (xx + yy)) * s.z,
      0,
      t.x,
      t.y,
      t.z,
      1,
    ];
  };

  /** Matrix product `a 쨌 b` (apply `b` first, then `a`), column-major. */
  export const multiply = (a: number[], b: number[]): number[] => {
    const out = new Array<number>(16);
    for (let col = 0; col < 4; ++col)
      for (let row = 0; row < 4; ++row) {
        let sum = 0;
        for (let k = 0; k < 4; ++k) sum += a[k * 4 + row]! * b[col * 4 + k]!;
        out[col * 4 + row] = sum;
      }
    return out;
  };

  /** The translation column of a matrix. */
  export const position = (m: number[]): IautomovieVector3 => ({
    x: m[12]!,
    y: m[13]!,
    z: m[14]!,
  });

  /**
   * Split a transform matrix back into its TRS triple (the inverse of
   * {@link compose}), matching `three.js` `Matrix4.decompose`. Scale is taken as
   * the basis-column lengths (assumed positive ??the engine never mirrors); the
   * rotation is read from the scale-normalized basis via the standard
   * largest-diagonal quaternion extraction.
   *
   * The world-space driver pass needs this: a driver reads a node's _world_
   * orientation/position out of its composed matrix, recomputes it (aim,
   * parent, IK), and recomposes.
   */
  export const decompose = (
    m: number[],
  ): {
    position: IautomovieVector3;
    rotation: IautomovieQuaternion;
    scale: IautomovieVector3;
  } => {
    const sx = Math.hypot(m[0]!, m[1]!, m[2]!);
    const sy = Math.hypot(m[4]!, m[5]!, m[6]!);
    const sz = Math.hypot(m[8]!, m[9]!, m[10]!);

    // scale-normalized rotation basis, r[row][col]
    const r00 = m[0]! / sx;
    const r10 = m[1]! / sx;
    const r20 = m[2]! / sx;
    const r01 = m[4]! / sy;
    const r11 = m[5]! / sy;
    const r21 = m[6]! / sy;
    const r02 = m[8]! / sz;
    const r12 = m[9]! / sz;
    const r22 = m[10]! / sz;

    const trace = r00 + r11 + r22;
    let x: number;
    let y: number;
    let z: number;
    let w: number;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      w = 0.25 / s;
      x = (r21 - r12) * s;
      y = (r02 - r20) * s;
      z = (r10 - r01) * s;
    } else if (r00 > r11 && r00 > r22) {
      const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
      w = (r21 - r12) / s;
      x = 0.25 * s;
      y = (r01 + r10) / s;
      z = (r02 + r20) / s;
    } else if (r11 > r22) {
      const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
      w = (r02 - r20) / s;
      x = (r01 + r10) / s;
      y = 0.25 * s;
      z = (r12 + r21) / s;
    } else {
      const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
      w = (r10 - r01) / s;
      x = (r02 + r20) / s;
      y = (r12 + r21) / s;
      z = 0.25 * s;
    }
    return {
      position: { x: m[12]!, y: m[13]!, z: m[14]! },
      rotation: { x, y, z, w },
      scale: { x: sx, y: sy, z: sz },
    };
  };
}
