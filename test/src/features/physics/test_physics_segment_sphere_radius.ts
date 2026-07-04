import { projectileSphereHit, segmentSphere } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const v = (x: number, y: number, z: number) => ({ x, y, z });

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * Sphere collision radii are physical dimensions and must be finite positive
 * numbers before quadratic hit math starts. Squaring an invalid radius must not
 * turn caller bugs into misses, instant hits, or valid positive radii.
 *
 * Scenarios:
 *
 * 1. `segmentSphere` rejects non-finite and non-positive radii before solving its
 *    quadratic.
 * 2. `projectileSphereHit` inherits the same radius rejection through the sphere
 *    passed into its sampled segment checks.
 */
export const test_physics_segment_sphere_radius = (): void => {
  const a = v(0, 0, 0);
  const b = v(10, 0, 0);
  const center = v(5, 0, 0);

  for (const radius of [Number.NaN, Infinity, 0, -1])
    TestValidator.predicate(
      `segment radius ${radius} throws`,
      throws(() => segmentSphere(a, b, center, radius)),
    );

  TestValidator.predicate(
    "projectile sphere radius throws",
    throws(() =>
      projectileSphereHit(
        {
          origin: a,
          velocity: v(10, 0, 0),
          gravity: v(0, 0, 0),
        },
        { center, radius: -1 },
        1,
        10,
      ),
    ),
  );
};
