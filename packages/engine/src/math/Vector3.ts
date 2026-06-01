import { IMoticaVector3 } from "@motica/interface";

/**
 * Pure-function vector math over {@link IMoticaVector3} (`{ x, y, z }`).
 *
 * Stateless helpers — every operation returns a fresh object and never mutates
 * its inputs. The engine keeps its own tiny math layer (rather than depending
 * on `three.js`) so it stays renderer-agnostic and runnable headless.
 *
 * @author Samchon
 */
export namespace Vector3 {
  export const create = (x = 0, y = 0, z = 0): IMoticaVector3 => ({ x, y, z });

  export const add = (
    a: IMoticaVector3,
    b: IMoticaVector3,
  ): IMoticaVector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  });

  export const subtract = (
    a: IMoticaVector3,
    b: IMoticaVector3,
  ): IMoticaVector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

  export const scale = (a: IMoticaVector3, s: number): IMoticaVector3 => ({
    x: a.x * s,
    y: a.y * s,
    z: a.z * s,
  });

  export const dot = (a: IMoticaVector3, b: IMoticaVector3): number =>
    a.x * b.x + a.y * b.y + a.z * b.z;

  export const cross = (
    a: IMoticaVector3,
    b: IMoticaVector3,
  ): IMoticaVector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });

  export const length = (a: IMoticaVector3): number => Math.sqrt(dot(a, a));

  export const normalize = (a: IMoticaVector3): IMoticaVector3 => {
    const len = length(a);
    return len === 0 ? create(0, 0, 0) : scale(a, 1 / len);
  };

  /** Component-wise linear interpolation, `t` in `[0, 1]`. */
  export const lerp = (
    a: IMoticaVector3,
    b: IMoticaVector3,
    t: number,
  ): IMoticaVector3 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  });
}
