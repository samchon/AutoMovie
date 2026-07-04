import { projectileAt, solveBallisticLaunch } from "@automovie/engine";
import { IautomovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

const GRAVITY: IautomovieVector3 = { x: 0, y: -9.81, z: 0 };

/** Where the projectile is at the solution's hit time. */
const landing = (
  origin: IautomovieVector3,
  sol: NonNullable<ReturnType<typeof solveBallisticLaunch>>,
  gravity = GRAVITY,
): IautomovieVector3 =>
  projectileAt({ origin, velocity: sol.velocity, gravity }, sol.hitTime)
    .position;

/**
 * `solveBallisticLaunch` ??the inverse of the forward projectile simulation:
 * the launch velocity that connects. The contract is the forward oracle ??fire
 * the returned velocity and, at the returned hit time, the projectile is on the
 * target. Any error in the range equation shows up as a miss.
 *
 * Scenarios:
 *
 * 1. A ground-to-ground shot (target level, downrange) ??the direct arc lands on
 *    it, and the launch speed matches the requested speed.
 * 2. The high arc reaches the same target with a steeper, slower-horizontal lob (a
 *    longer flight time than the direct arc).
 * 3. A raised and a lowered target both land (positive and negative height).
 * 4. Zero gravity ??a straight shot down the sightline (velocity ??delta).
 * 5. A purely vertical target (straight up) lands; a vertical target straight down
 *    lands too; and a vertical target too high for the speed ??null.
 * 6. A target out of range at the given speed ??null.
 */
export const test_physics_ballistic = (): void => {
  const origin: IautomovieVector3 = { x: 0, y: 1, z: 0 };

  const level: IautomovieVector3 = { x: 8, y: 1, z: 3 };
  const direct = solveBallisticLaunch(origin, level, 14)!;
  TestValidator.predicate(
    "direct arc lands on the level target",
    vclose(landing(origin, direct), level, 1e-3),
  );
  TestValidator.predicate(
    "launch speed matches the request",
    Math.abs(
      Math.hypot(direct.velocity.x, direct.velocity.y, direct.velocity.z) - 14,
    ) < 1e-6,
  );

  const high = solveBallisticLaunch(origin, level, 14, GRAVITY, "high")!;
  TestValidator.predicate(
    "high arc lands on the same target",
    vclose(landing(origin, high), level, 1e-3),
  );
  TestValidator.predicate(
    "the high arc flies longer than the direct arc",
    high.hitTime > direct.hitTime,
  );

  const up: IautomovieVector3 = { x: 6, y: 4.5, z: -2 };
  const down: IautomovieVector3 = { x: 6, y: -1.5, z: -2 };
  TestValidator.predicate(
    "a raised target lands",
    vclose(landing(origin, solveBallisticLaunch(origin, up, 14)!), up, 1e-3),
  );
  TestValidator.predicate(
    "a lowered target lands",
    vclose(
      landing(origin, solveBallisticLaunch(origin, down, 14)!),
      down,
      1e-3,
    ),
  );

  const straight: IautomovieVector3 = { x: 5, y: 1, z: 5 };
  const noG = solveBallisticLaunch(origin, straight, 10, { x: 0, y: 0, z: 0 })!;
  TestValidator.predicate(
    "zero gravity is a straight shot on target",
    vclose(landing(origin, noG, { x: 0, y: 0, z: 0 }), straight, 1e-6),
  );
  TestValidator.equals(
    "zero gravity, target on the origin ??null",
    solveBallisticLaunch(origin, origin, 10, { x: 0, y: 0, z: 0 }),
    null,
  );
  TestValidator.equals(
    "zero gravity, zero speed ??null",
    solveBallisticLaunch(origin, straight, 0, { x: 0, y: 0, z: 0 }),
    null,
  );

  const overhead: IautomovieVector3 = { x: 0, y: 6, z: 0 };
  const vertical = solveBallisticLaunch(origin, overhead, 12)!;
  TestValidator.predicate(
    "a purely vertical target lands",
    vclose(landing(origin, vertical), overhead, 1e-3),
  );
  const belowPit: IautomovieVector3 = { x: 0, y: -4, z: 0 };
  TestValidator.predicate(
    "a vertical target straight down lands",
    vclose(
      landing(origin, solveBallisticLaunch(origin, belowPit, 6)!),
      belowPit,
      1e-3,
    ),
  );
  TestValidator.equals(
    "a vertical target too high for the speed ??null",
    solveBallisticLaunch(origin, { x: 0, y: 50, z: 0 }, 5),
    null,
  );

  TestValidator.equals(
    "a target out of range ??null",
    solveBallisticLaunch(origin, { x: 100, y: 1, z: 0 }, 8),
    null,
  );
};
