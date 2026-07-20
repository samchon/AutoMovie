import { projectileSphereHit, segmentSphere } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const v = (x: number, y: number, z: number) => ({ x, y, z });

/**
 * `segmentSphere` + `projectileSphereHit`: the collision tests behind a hit.
 *
 * `segmentSphere` scenarios (cover every branch):
 *
 * 1. Normal entry: segment (0,0,0)→(10,0,0) crosses a sphere at (5,0,0) r=1 →
 *    first contact at x=4, parameter s=0.4.
 * 2. Clean miss → null.
 * 3. Degenerate segment (a==b) inside the sphere → 0; outside → null.
 * 4. Start point already inside the sphere → 0.
 * 5. The line hits the sphere but only beyond the segment's end → null.
 *
 * `projectileSphereHit`:
 *
 * 6. An arc launched at (0,0,0) with velocity (10,5,0) under g=(0,−10,0) passes
 *    through (10,0,0) at t=1; a unit sphere there is hit at ≈t=1.
 * 7. A sphere far off the path is never hit → null.
 */
export const test_physics_collision = (): void => {
  // 1. normal entry
  TestValidator.predicate(
    "segment enters sphere at s=0.4",
    nclose(segmentSphere(v(0, 0, 0), v(10, 0, 0), v(5, 0, 0), 1)!, 0.4),
  );
  // 2. miss
  TestValidator.equals(
    "parallel miss → null",
    segmentSphere(v(0, 0, 0), v(10, 0, 0), v(5, 5, 0), 1),
    null,
  );
  // 3. degenerate segment
  TestValidator.equals(
    "point inside → 0",
    segmentSphere(v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), 1),
    0,
  );
  TestValidator.equals(
    "point outside → null",
    segmentSphere(v(5, 0, 0), v(5, 0, 0), v(0, 0, 0), 1),
    null,
  );
  // 4. start already inside
  TestValidator.equals(
    "start inside → 0",
    segmentSphere(v(5, 0, 0), v(10, 0, 0), v(5, 0, 0), 1),
    0,
  );
  // 5. intersection beyond the segment end → null
  TestValidator.equals(
    "hit lies past the segment → null",
    segmentSphere(v(0, 0, 0), v(1, 0, 0), v(5, 0, 0), 1),
    null,
  );

  // 6. projectile arcs into a sphere
  const hit = projectileSphereHit(
    { origin: v(0, 0, 0), velocity: v(10, 5, 0), gravity: v(0, -10, 0) },
    { center: v(10, 0, 0), radius: 1 },
    2,
  );
  TestValidator.predicate("projectile hit detected", hit !== null);
  // the path reaches the centre at t=1, so it ENTERS the r=1 sphere a touch
  // earlier (~0.9s): contact is the surface crossing, not the centre crossing
  TestValidator.predicate(
    "hit time just before the centre crossing",
    hit!.time > 0.8 && hit!.time <= 1.0,
  );
  TestValidator.predicate(
    "hit point on/inside the sphere",
    Math.hypot(hit!.point.x - 10, hit!.point.y, hit!.point.z) <= 1.001,
  );

  // 7. nothing in the way
  TestValidator.equals(
    "no collider on the path → null",
    projectileSphereHit(
      { origin: v(0, 0, 0), velocity: v(10, 5, 0), gravity: v(0, -10, 0) },
      { center: v(0, 50, 0), radius: 1 },
      2,
    ),
    null,
  );
};
