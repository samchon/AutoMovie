import { IAutoMovieVector3 } from "@automovie/interface";

import { Vector3 } from "../math/Vector3";

/** The launch that hits a target: the initial velocity and the time of flight. */
export interface IAutoMovieBallisticSolution {
  /** Initial velocity to give the projectile (world m/s), magnitude = speed. */
  velocity: IAutoMovieVector3;

  /** Seconds until it reaches the target. */
  hitTime: number;
}

/**
 * Solve the **launch velocity** that lands a projectile fired from `origin` at
 * fixed `speed` onto `target` under a constant `gravity` — the inverse of the
 * forward {@link projectileAt} simulation, and the missing half of the `launch`
 * verb (the model says "loose the arrow at speed s"; the engine finds the aim
 * that connects). Returns `null` when the target is out of range at that
 * speed.
 *
 * Under downward gravity a target has two firing arcs — a flat **direct** shot
 * and a lobbed **high** one — selected by `arc`; the direct arc is the default.
 * With zero gravity it degenerates to a straight shot along the sightline. The
 * horizontal solve uses the standard range equation `tanθ = (s² ± √(s⁴ −
 * g(g·d²
 *
 * - 2h·s²))) / (g·d)`; a purely vertical target is handled on its own (no
 *   horizontal direction to aim along).
 *
 * @author Samchon
 */
export const solveBallisticLaunch = (
  origin: IAutoMovieVector3,
  target: IAutoMovieVector3,
  speed: number,
  gravity: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 },
  arc: "direct" | "high" = "direct",
): IAutoMovieBallisticSolution | null => {
  const delta = Vector3.subtract(target, origin);
  const g = Vector3.length(gravity);

  // No gravity: a straight shot down the sightline.
  if (g < 1e-9) {
    const range = Vector3.length(delta);
    if (range < 1e-9 || speed <= 0) return null;
    return {
      velocity: Vector3.scale(Vector3.normalize(delta), speed),
      hitTime: range / speed,
    };
  }

  const up = Vector3.scale(gravity, -1 / g); // unit "up" (against gravity)
  const h = Vector3.dot(delta, up); // signed height along up
  const horizontal = Vector3.subtract(delta, Vector3.scale(up, h));
  const d = Vector3.length(horizontal);
  const s2 = speed * speed;

  // Purely vertical target: fire straight up/down; solve when it reaches h.
  if (d < 1e-9) {
    // origin + v·t + ½·(−g)·t² = h  with v = ±speed along up.
    for (const v of [speed, -speed]) {
      const disc = v * v - 2 * g * h;
      if (disc < 0) continue;
      const t = (v + Math.sqrt(disc)) / g; // first non-negative crossing
      if (t > 1e-9) return { velocity: Vector3.scale(up, v), hitTime: t };
    }
    return null;
  }

  // Range equation for the launch angle θ above the horizontal.
  const disc = s2 * s2 - g * (g * d * d + 2 * h * s2);
  if (disc < 0) return null; // out of range at this speed
  const root = Math.sqrt(disc);
  const tanTheta = (s2 + (arc === "high" ? root : -root)) / (g * d);
  const cosTheta = 1 / Math.sqrt(1 + tanTheta * tanTheta);
  const sinTheta = tanTheta * cosTheta;

  const horizontalDir = Vector3.scale(horizontal, 1 / d);
  const velocity = Vector3.add(
    Vector3.scale(horizontalDir, speed * cosTheta),
    Vector3.scale(up, speed * sinTheta),
  );
  return { velocity, hitTime: d / (speed * cosTheta) };
};

/**
 * Solve the launch that **leads a moving target** — the aim that lands the
 * projectile where the target _will be_, not where it is. `targetAt(t)` gives
 * the target's world position at flight-time `t` (e.g. its animated base plus
 * root travel). This is the reactive event the `launch` verb promises against a
 * mover ("shoot him off his galloping horse") without the model timing it.
 *
 * A fixed-point iteration on the time of flight: guess `t` from the target's
 * current distance, {@link solveBallisticLaunch aim} at `targetAt(t)`, take that
 * solve's `hitTime` as the next `t`, and repeat until it settles. It converges
 * when the target is slower than the projectile (each aim overshoots the last
 * miss by less); a target that outruns the shot never settles, so the loop is
 * capped at `iterations` and returns the closest solve found. Returns `null`
 * when the intercept is out of range at that speed (or the speed is
 * non-positive).
 *
 * @author Samchon
 */
export const solveMovingLaunch = (
  origin: IAutoMovieVector3,
  targetAt: (t: number) => IAutoMovieVector3,
  speed: number,
  gravity: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 },
  arc: "direct" | "high" = "direct",
  iterations = 8,
): IAutoMovieBallisticSolution | null => {
  if (!(speed > 0)) return null;
  let t = Vector3.length(Vector3.subtract(targetAt(0), origin)) / speed;
  let solution: IAutoMovieBallisticSolution | null = null;
  for (let i = 0; i < iterations; ++i) {
    solution = solveBallisticLaunch(origin, targetAt(t), speed, gravity, arc);
    if (solution === null) return null; // out of range at this iterate
    if (Math.abs(solution.hitTime - t) < 1e-6) return solution; // settled
    t = solution.hitTime;
  }
  return solution;
};
