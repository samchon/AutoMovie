import { IMoticaQuaternion, IMoticaVector3 } from "@motica/interface";

/**
 * Pure-function 4×4 matrix math, column-major (glTF / `three.js` storage order:
 * element `m[col * 4 + row]`).
 *
 * The interface never exposes a matrix — nodes carry decomposed TRS so every
 * value stays animatable ({@link IMoticaTransform}). But composing a hierarchy
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
   * · R · S`.
   */
  export const compose = (
    t: IMoticaVector3,
    r: IMoticaQuaternion,
    s: IMoticaVector3,
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

  /** Matrix product `a · b` (apply `b` first, then `a`), column-major. */
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
}
