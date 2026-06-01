import { IMoticaQuaternion, IMoticaVector3 } from "@motica/interface";

/**
 * Pure-function quaternion math over {@link IMoticaQuaternion} (`(x, y, z, w)`,
 * glTF order).
 *
 * Quaternions are the engine's internal rotation representation: the LLM emits
 * semantic degrees, {@link "../kinematics/jointToQuaternion".jointToQuaternion}
 * turns those into quaternions, and the renderer consumes them. All helpers are
 * stateless and return fresh objects.
 *
 * @author Samchon
 */
export namespace Quaternion {
  export const identity = (): IMoticaQuaternion => ({ x: 0, y: 0, z: 0, w: 1 });

  export const DEG2RAD = Math.PI / 180;

  /** Hamilton product `a * b` (apply `b` first, then `a`). */
  export const multiply = (
    a: IMoticaQuaternion,
    b: IMoticaQuaternion,
  ): IMoticaQuaternion => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });

  export const normalize = (q: IMoticaQuaternion): IMoticaQuaternion => {
    const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    if (len === 0) return identity();
    const inv = 1 / len;
    return { x: q.x * inv, y: q.y * inv, z: q.z * inv, w: q.w * inv };
  };

  /** Rotation of `angleDeg` degrees about a (not necessarily unit) `axis`. */
  export const fromAxisAngle = (
    axis: IMoticaVector3,
    angleDeg: number,
  ): IMoticaQuaternion => {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len === 0) return identity();
    const half = (angleDeg * DEG2RAD) / 2;
    const s = Math.sin(half) / len;
    return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
  };

  /** Rotate a vector by a quaternion: `q * v * q⁻¹`. */
  export const rotateVector = (
    q: IMoticaQuaternion,
    v: IMoticaVector3,
  ): IMoticaVector3 => {
    // t = 2 * cross(q.xyz, v); v' = v + q.w * t + cross(q.xyz, t)
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
      x: v.x + q.w * tx + (q.y * tz - q.z * ty),
      y: v.y + q.w * ty + (q.z * tx - q.x * tz),
      z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
  };

  /** Spherical linear interpolation, `t` in `[0, 1]`. */
  export const slerp = (
    a: IMoticaQuaternion,
    b: IMoticaQuaternion,
    t: number,
  ): IMoticaQuaternion => {
    let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let bx = b.x;
    let by = b.y;
    let bz = b.z;
    let bw = b.w;
    if (cos < 0) {
      // take the shorter arc
      cos = -cos;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }
    if (cos > 0.9995) {
      // nearly parallel — fall back to normalized lerp
      return normalize({
        x: a.x + (bx - a.x) * t,
        y: a.y + (by - a.y) * t,
        z: a.z + (bz - a.z) * t,
        w: a.w + (bw - a.w) * t,
      });
    }
    const theta = Math.acos(cos);
    const sin = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sin;
    const wb = Math.sin(t * theta) / sin;
    return {
      x: a.x * wa + bx * wb,
      y: a.y * wa + by * wb,
      z: a.z * wa + bz * wb,
      w: a.w * wa + bw * wb,
    };
  };
}
