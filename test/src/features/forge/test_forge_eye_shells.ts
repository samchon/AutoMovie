import { CANONICAL_FACE_POSITIONS, buildEyeShells } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Eyeballs fit their lid rings: each sphere's lateral center matches its ring
 * centroid, the two are mirror twins (x signs opposite, same radius), the front
 * pole sits 0.8mm proud of the lid plane, and every vertex lies on the sphere
 * (radius within float error).
 *
 * Scenario: default canonical build; mirror symmetry, pole-vs-lid offset, and
 * on-sphere check for the right eye's vertices.
 */
export const test_forge_eye_shells = (): void => {
  const { right, left } = buildEyeShells();
  TestValidator.predicate(
    "mirror twins",
    nclose(right.center[0]!, -left.center[0]!, 1e-3) &&
      nclose(right.radius, left.radius, 1e-3),
  );
  const RING_R = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  ];
  let lidZ = 0;
  for (const i of RING_R) lidZ += CANONICAL_FACE_POSITIONS[i * 3 + 2]! / 16;
  TestValidator.predicate(
    "front pole proud of the lid plane",
    nclose(right.center[2]!, lidZ + 0.0008, 1e-4),
  );
  const cz = right.center[2]! - right.radius;
  let onSphere = true;
  for (let i = 0; i < right.positions.length; i += 3) {
    const d = Math.hypot(
      right.positions[i]! - right.center[0]!,
      right.positions[i + 1]! - right.center[1]!,
      right.positions[i + 2]! - cz,
    );
    if (!nclose(d, right.radius, 1e-6)) onSphere = false;
  }
  TestValidator.predicate("vertices on the sphere", onSphere);
};
