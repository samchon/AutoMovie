import { IautomovieClip, IautomovieVector3 } from "@automovie/interface";

import { aimRotation } from "../kinematics/aimRotation";
import { Vector3 } from "../math/Vector3";

/** A projectile model faces +Z; its trajectory rotates that onto the flight. */
const PROJECTILE_FORWARD: IautomovieVector3 = { x: 0, y: 0, z: 1 };

/**
 * A ballistic **projectile** launch: an origin, an initial velocity, and a
 * constant acceleration (gravity). This is the minimal state needed to fly an
 * arrow, a thrown spear, or any free body ??the first taste of _simulation_
 * (state evolving under physical law) rather than authored keyframes.
 *
 * @author Samchon
 */
export interface IautomovieProjectile {
  /** Launch position (world meters). */
  origin: IautomovieVector3;
  /** Initial velocity (world meters/second). */
  velocity: IautomovieVector3;
  /** Constant acceleration, e.g. gravity `{ x: 0, y: -9.81, z: 0 }`. */
  gravity: IautomovieVector3;
}

/** Position + velocity of a projectile at one instant. */
export interface IautomovieProjectileState {
  position: IautomovieVector3;
  velocity: IautomovieVector3;
}

/**
 * Evaluate a {@link IautomovieProjectile} at time `t` seconds (closed form, no
 * integration error): `p = origin + v쨌t + 쩍쨌g쨌t짼`, `v(t) = v + g쨌t`. The
 * velocity also gives the flight direction, so a renderer can orient the arrow
 * along its arc (e.g. via `aimRotation`).
 *
 * @author Samchon
 */
export const projectileAt = (
  p: IautomovieProjectile,
  t: number,
): IautomovieProjectileState => ({
  position: Vector3.add(
    Vector3.add(p.origin, Vector3.scale(p.velocity, t)),
    Vector3.scale(p.gravity, 0.5 * t * t),
  ),
  velocity: Vector3.add(p.velocity, Vector3.scale(p.gravity, t)),
});

/**
 * Bake a projectile's flight into an {@link IautomovieClip} for its scene node ?? * position sampled from {@link projectileAt} at `fps`, plus a rotation track
 * that keeps the model's forward (+Z) pointing down the arc's velocity, so the
 * arrow noses over as it falls. This is the projectile half of the `launch`
 * verb (paired with the aim `solveBallisticLaunch` computed): the host applies
 * the clip to the thrown prop and plays it through `sampleClip`.
 *
 * Samples the closed-form solution, so there is no integration drift; the last
 * key lands exactly on `duration`.
 *
 * @author Samchon
 */
export const projectileTrajectory = (
  node: string,
  p: IautomovieProjectile,
  duration: number,
  fps = 30,
): IautomovieClip => {
  const count = Math.max(1, Math.round(duration * fps));
  const times: number[] = [];
  const pos: number[] = [];
  const rot: number[] = [];
  for (let i = 0; i <= count; ++i) {
    const t = (i / count) * duration;
    const { position, velocity } = projectileAt(p, t);
    times.push(t);
    pos.push(position.x, position.y, position.z);
    const q = aimRotation(PROJECTILE_FORWARD, velocity);
    rot.push(q.x, q.y, q.z, q.w);
  }
  return {
    id: `trajectory:${node}`,
    name: null,
    duration,
    loop: false,
    tracks: [
      {
        channel: { kind: "node", node, path: "translation" },
        times,
        values: pos,
        interpolation: "linear",
      },
      {
        channel: { kind: "node", node, path: "rotation" },
        times,
        values: rot,
        interpolation: "linear",
      },
    ],
  };
};
