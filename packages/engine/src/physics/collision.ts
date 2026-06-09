import { IAutoFilmVector3 } from "@autofilm/interface";

import { Vector3 } from "../math/Vector3";
import { IAutoFilmProjectile, projectileAt } from "./projectile";

/**
 * A world-space sphere collider — the simplest body to test a hit against (an
 * arrow vs. a rider's torso). Cheap, rotation-free, and enough to answer the
 * one question a strike needs: _did it connect, and when?_
 *
 * @author Samchon
 */
export interface IAutoFilmSphere {
  center: IAutoFilmVector3;
  radius: number;
}

/** A detected hit: the parameter/time of first contact and the contact point. */
export interface IAutoFilmHit {
  /** Time (or segment parameter) of first contact. */
  time: number;
  /** World point of first contact. */
  point: IAutoFilmVector3;
}

/**
 * First intersection of the segment `a→b` with a sphere, as the parameter `s ∈
 * [0, 1]` where contact begins (`a + s·(b−a)`), or `null` if the segment never
 * touches the sphere. If `a` already lies inside, returns `0`.
 *
 * Solves `|a + s·d − c|² = r²` (a quadratic in `s`) and returns the entry root
 * that falls within the segment. A degenerate segment (`a == b`) reduces to a
 * point-in-sphere test.
 *
 * @author Samchon
 */
export const segmentSphere = (
  a: IAutoFilmVector3,
  b: IAutoFilmVector3,
  c: IAutoFilmVector3,
  radius: number,
): number | null => {
  const d = Vector3.subtract(b, a);
  const m = Vector3.subtract(a, c);
  const A = Vector3.dot(d, d);
  const C = Vector3.dot(m, m) - radius * radius;
  if (A === 0) return C <= 0 ? 0 : null; // a == b: point test
  const B = 2 * Vector3.dot(m, d);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const s1 = (-B - root) / (2 * A); // entry
  const s2 = (-B + root) / (2 * A); // exit
  if (s1 >= 0 && s1 <= 1) return s1; // enters within the segment
  if (s1 < 0 && s2 >= 0) return 0; // a is inside the sphere
  return null; // intersection lies off the segment
};

/**
 * March a {@link IAutoFilmProjectile} over `[0, tMax]` in `steps` straight
 * segments and return the first time/point its path enters `sphere`, or `null`
 * if it never does within the window. Sampling the arc as segments keeps the
 * test exact per segment (the projectile is smooth, so a modest `steps`
 * resolves the contact time closely).
 *
 * @author Samchon
 */
export const projectileSphereHit = (
  projectile: IAutoFilmProjectile,
  sphere: IAutoFilmSphere,
  tMax: number,
  steps = 120,
): IAutoFilmHit | null => {
  const dt = tMax / steps;
  let prev = projectileAt(projectile, 0).position;
  for (let i = 1; i <= steps; ++i) {
    const t = i * dt;
    const cur = projectileAt(projectile, t).position;
    const s = segmentSphere(prev, cur, sphere.center, sphere.radius);
    if (s !== null)
      return {
        time: (i - 1) * dt + s * dt,
        point: Vector3.lerp(prev, cur, s),
      };
    prev = cur;
  }
  return null;
};
