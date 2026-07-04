import {
  IAutoMovieProjectile,
  Quaternion,
  projectileAt,
  projectileTrajectory,
  sampleClip,
  solveBallisticLaunch,
} from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

/**
 * `projectileTrajectory` — bake a projectile's flight into a node clip. The
 * contract is that the baked clip agrees with the closed-form
 * {@link projectileAt} at every sampled instant, and its rotation keeps the
 * model's +Z along the velocity so the arrow noses over.
 *
 * Scenarios:
 *
 * 1. A 30 fps trajectory over a 1 s flight has 31 keys (endpoints included) on
 *    both a translation and a rotation track for the projectile node, closing
 *    exactly on the duration.
 * 2. Sampling the clip at several instants matches `projectileAt`'s position.
 * 3. The rotation aims +Z down the instantaneous velocity — at the top of a lobbed
 *    arc the arrow is level, and by landing it noses downward.
 * 4. End to end with the aim solver: fire a solved launch, bake its flight, and
 *    the clip's last position sits on the target.
 */
export const test_physics_trajectory = (): void => {
  const p: IAutoMovieProjectile = {
    origin: { x: 0, y: 1, z: 0 },
    velocity: { x: 5, y: 8, z: 2 },
    gravity: { x: 0, y: -9.81, z: 0 },
  };
  const clip = projectileTrajectory("arrow", p, 1, 30);

  TestValidator.equals(
    "translation + rotation tracks on the node",
    clip.tracks.map((t) => (t.channel.kind === "node" ? t.channel.path : "")),
    ["translation", "rotation"],
  );
  TestValidator.equals(
    "31 keys over 1 s at 30 fps",
    clip.tracks[0]!.times.length,
    31,
  );
  TestValidator.predicate(
    "closes on the duration",
    nclose(clip.tracks[0]!.times[30]!, 1),
  );

  // Check at frame-aligned instants (multiples of 1/30) where the clip's
  // linear track returns the baked value exactly — between samples the linear
  // interpolation of a parabola drifts, as it should.
  for (const t of [0, 0.3, 20 / 30, 1]) {
    const sampled = sampleClip(clip, t).get("node:arrow:translation")!.value;
    TestValidator.predicate(
      `position at ${t.toFixed(3)}s matches projectileAt`,
      vclose(
        { x: sampled[0]!, y: sampled[1]!, z: sampled[2]! },
        projectileAt(p, t).position,
        1e-6,
      ),
    );
  }

  const rotAt = (t: number): IAutoMovieVector3 => {
    const v = sampleClip(clip, t).get("node:arrow:rotation")!.value;
    return Quaternion.rotateVector(
      { x: v[0]!, y: v[1]!, z: v[2]!, w: v[3]! },
      { x: 0, y: 0, z: 1 },
    );
  };
  const apex = 8 / 9.81; // v_y / g — the top of the arc
  TestValidator.predicate(
    "at the apex the arrow is level (no vertical velocity)",
    nclose(rotAt(apex).y, 0, 1e-3),
  );
  TestValidator.predicate(
    "by landing the arrow noses downward",
    rotAt(1).y < 0,
  );

  // 4. end to end with the aim
  const origin: IAutoMovieVector3 = { x: 0, y: 1.6, z: 0 };
  const target: IAutoMovieVector3 = { x: 12, y: 1.2, z: 4 };
  const sol = solveBallisticLaunch(origin, target, 16)!;
  const flight = projectileTrajectory(
    "bolt",
    { origin, velocity: sol.velocity, gravity: p.gravity },
    sol.hitTime,
    60,
  );
  const last = flight.tracks[0]!.values;
  TestValidator.predicate(
    "the baked flight ends on the target",
    vclose(
      {
        x: last[last.length - 3]!,
        y: last[last.length - 2]!,
        z: last[last.length - 1]!,
      },
      target,
      2e-3,
    ),
  );
};
