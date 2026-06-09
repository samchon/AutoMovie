import { IAutoFilmVector3 } from "@autofilm/interface";

/**
 * Pure-function vector math over {@link IAutoFilmVector3} (`{ x, y, z }`).
 *
 * Stateless helpers — every operation returns a fresh object and never mutates
 * its inputs. The engine keeps its own tiny math layer (rather than depending
 * on `three.js`) so it stays renderer-agnostic and runnable headless.
 *
 * @author Samchon
 */
export namespace Vector3 {
  export const create = (x = 0, y = 0, z = 0): IAutoFilmVector3 => ({
    x,
    y,
    z,
  });

  export const add = (
    a: IAutoFilmVector3,
    b: IAutoFilmVector3,
  ): IAutoFilmVector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  });

  export const subtract = (
    a: IAutoFilmVector3,
    b: IAutoFilmVector3,
  ): IAutoFilmVector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

  export const scale = (a: IAutoFilmVector3, s: number): IAutoFilmVector3 => ({
    x: a.x * s,
    y: a.y * s,
    z: a.z * s,
  });

  export const dot = (a: IAutoFilmVector3, b: IAutoFilmVector3): number =>
    a.x * b.x + a.y * b.y + a.z * b.z;

  export const cross = (
    a: IAutoFilmVector3,
    b: IAutoFilmVector3,
  ): IAutoFilmVector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });

  export const length = (a: IAutoFilmVector3): number => Math.sqrt(dot(a, a));

  export const normalize = (a: IAutoFilmVector3): IAutoFilmVector3 => {
    const len = length(a);
    return len === 0 ? create(0, 0, 0) : scale(a, 1 / len);
  };

  /** Component-wise linear interpolation, `t` in `[0, 1]`. */
  export const lerp = (
    a: IAutoFilmVector3,
    b: IAutoFilmVector3,
    t: number,
  ): IAutoFilmVector3 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  });
}
