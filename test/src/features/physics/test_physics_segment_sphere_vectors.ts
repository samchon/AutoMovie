import { projectileSphereHit, segmentSphere } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

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
 * Segment/sphere collision vectors must be finite before quadratic hit math.
 * Invalid vector components otherwise become `NaN` roots and can be mistaken
 * for a clean miss.
 *
 * Scenarios:
 *
 * 1. Non-finite segment start, segment end, and sphere center components throw.
 * 2. `projectileSphereHit` inherits center-vector rejection through sampled
 *    segment checks.
 * 3. Finite segment/sphere intersection behavior is preserved.
 */
export const test_physics_segment_sphere_vectors = (): void => {
  const a = v(0, 0, 0);
  const b = v(10, 0, 0);
  const center = v(5, 0, 0);

  TestValidator.predicate(
    "non-finite segment start throws",
    throws(() => segmentSphere(v(Number.NaN, 0, 0), b, center, 1)),
  );
  TestValidator.predicate(
    "non-finite segment end throws",
    throws(() => segmentSphere(a, v(10, Infinity, 0), center, 1)),
  );
  TestValidator.predicate(
    "non-finite sphere center throws",
    throws(() => segmentSphere(a, b, v(5, 0, -Infinity), 1)),
  );
  TestValidator.predicate(
    "projectile sphere center throws",
    throws(() =>
      projectileSphereHit(
        {
          origin: a,
          velocity: v(10, 0, 0),
          gravity: v(0, 0, 0),
        },
        { center: v(Number.NaN, 0, 0), radius: 1 },
        1,
        10,
      ),
    ),
  );

  TestValidator.predicate(
    "finite segment hit remains unchanged",
    nclose(segmentSphere(a, b, center, 1)!, 0.4),
  );
};
