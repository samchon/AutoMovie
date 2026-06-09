import { IAutoFilmVector3 } from "@autofilm/interface";

import { Vector3 } from "../math/Vector3";

/**
 * A ballistic **projectile** launch: an origin, an initial velocity, and a
 * constant acceleration (gravity). This is the minimal state needed to fly an
 * arrow, a thrown spear, or any free body — the first taste of _simulation_
 * (state evolving under physical law) rather than authored keyframes.
 *
 * @author Samchon
 */
export interface IAutoFilmProjectile {
  /** Launch position (world meters). */
  origin: IAutoFilmVector3;
  /** Initial velocity (world meters/second). */
  velocity: IAutoFilmVector3;
  /** Constant acceleration, e.g. gravity `{ x: 0, y: -9.81, z: 0 }`. */
  gravity: IAutoFilmVector3;
}

/** Position + velocity of a projectile at one instant. */
export interface IAutoFilmProjectileState {
  position: IAutoFilmVector3;
  velocity: IAutoFilmVector3;
}

/**
 * Evaluate a {@link IAutoFilmProjectile} at time `t` seconds (closed form, no
 * integration error): `p = origin + v·t + ½·g·t²`, `v(t) = v + g·t`. The
 * velocity also gives the flight direction, so a renderer can orient the arrow
 * along its arc (e.g. via `aimRotation`).
 *
 * @author Samchon
 */
export const projectileAt = (
  p: IAutoFilmProjectile,
  t: number,
): IAutoFilmProjectileState => ({
  position: Vector3.add(
    Vector3.add(p.origin, Vector3.scale(p.velocity, t)),
    Vector3.scale(p.gravity, 0.5 * t * t),
  ),
  velocity: Vector3.add(p.velocity, Vector3.scale(p.gravity, t)),
});
