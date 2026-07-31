import { Matrix4, Quaternion, Vector3 } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

/**
 * The engine package entrypoint exposes its core math namespaces as runtime
 * values, not declarations that disappear when a CommonJS consumer loads it.
 *
 * Scenarios:
 *
 * 1. `Quaternion` constructs a 90-degree +Y rotation and applies it to +X,
 *    guarding the public namespace and its dependent method at runtime.
 * 2. `Vector3` adds two exact vectors through the same package entrypoint.
 * 3. `Matrix4` composes the rotation with a translation and returns the exact
 *    translation column, guarding all three core runtime exports together.
 */
export const test_math_public_runtime_exports = (): void => {
  const rotation = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const rotated = Quaternion.rotateVector(rotation, { x: 1, y: 0, z: 0 });
  const translation = Vector3.add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 });
  const position = Matrix4.position(
    Matrix4.compose(translation, rotation, { x: 1, y: 1, z: 1 }),
  );

  TestValidator.predicate(
    "Quaternion is a live public runtime namespace",
    vclose(rotated, { x: 0, y: 0, z: -1 }, 1e-12),
  );
  TestValidator.equals(
    "Vector3 is a live public runtime namespace",
    translation,
    { x: 5, y: 7, z: 9 },
  );
  TestValidator.equals(
    "Matrix4 is a live public runtime namespace",
    position,
    translation,
  );
};
