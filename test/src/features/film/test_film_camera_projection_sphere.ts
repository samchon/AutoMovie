import { intersectsPerspectiveFrustumSphere } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const camera = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

const visible = (
  center: { x: number; y: number; z: number },
  radius: number,
): boolean =>
  intersectsPerspectiveFrustumSphere({
    camera,
    center,
    radius,
    near: 1,
    far: 10,
    halfY: 0.5,
    aspect: 2,
  });

/**
 * Perspective sphere visibility uses normalized frustum-plane distances.
 *
 * Scenarios:
 *
 * 1. Points and spheres wholly inside the camera frustum remain visible.
 * 2. Horizontal and vertical tangent spheres intersect exactly, while a center
 *    beyond the plane-normalized radius is rejected.
 * 3. Near/far tangent spheres intersect and separated spheres do not.
 * 4. Camera translation/rotation resolves the same local-space result.
 * 5. Negative and non-finite radii fail closed.
 */
export const test_film_camera_projection_sphere = (): void => {
  const horizontalTangent = 5 + Math.SQRT2;
  const verticalTangent = 2.5 + Math.hypot(1, 0.5);
  TestValidator.equals(
    "perspective side planes use exact normalized sphere distance",
    namedFacts([
      ["visibleX", () => visible({ x: 0, y: 0, z: -5 }, 0)],
      ["visibleX2", () => visible({ x: horizontalTangent, y: 0, z: -5 }, 1)],
      [
        "visibleX3",
        () =>
          visible({ x: horizontalTangent + 0.001, y: 0, z: -5 }, 1) === false,
      ],
      ["visibleX4", () => visible({ x: 0, y: verticalTangent, z: -5 }, 1)],
      [
        "visibleX5",
        () => visible({ x: 0, y: verticalTangent + 0.001, z: -5 }, 1) === false,
      ],
    ]),
    {
      visibleX: true,
      visibleX2: true,
      visibleX3: true,
      visibleX4: true,
      visibleX5: true,
    },
  );
  TestValidator.equals(
    "near and far planes include tangent spheres only",
    namedFacts([
      ["visibleX", () => visible({ x: 0, y: 0, z: -0.5 }, 0.5)],
      ["visibleX2", () => visible({ x: 0, y: 0, z: -0.499 }, 0.5) === false],
      ["visibleX3", () => visible({ x: 0, y: 0, z: -10.5 }, 0.5)],
      ["visibleX4", () => visible({ x: 0, y: 0, z: -10.501 }, 0.5) === false],
    ]),
    {
      visibleX: true,
      visibleX2: true,
      visibleX3: true,
      visibleX4: true,
    },
  );
  const half = Math.SQRT1_2;
  TestValidator.predicate(
    "camera world placement resolves before the shared frustum test",
    intersectsPerspectiveFrustumSphere({
      camera: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: half, z: 0, w: half },
      },
      center: { x: -4, y: 2, z: 3 },
      radius: 0,
      near: 1,
      far: 10,
      halfY: 0.5,
      aspect: 2,
    }),
  );
  TestValidator.predicate(
    "invalid sphere radii fail closed",
    visible({ x: 0, y: 0, z: -5 }, -1) === false &&
      visible({ x: 0, y: 0, z: -5 }, Number.NaN) === false,
  );
};
