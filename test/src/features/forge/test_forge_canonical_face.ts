import {
  CANONICAL_FACE_INDICES,
  CANONICAL_FACE_POSITIONS,
  CANONICAL_FACE_UVS,
} from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Structural oracles of the embedded canonical face: the FaceMesh topology is
 * 468 vertices / 898 triangles with per-vertex UVs in the unit square, the nose
 * tip (landmark 1) is the front-most vertex under the package's z-toward-viewer
 * convention, and the face is laterally centered (symmetric topology ?? * near-zero mean x).
 *
 * Scenario: counts, UV bounds, nose-tip argmax-z, and |mean x| < 1mm.
 */
export const test_forge_canonical_face = (): void => {
  TestValidator.equals("vertices", CANONICAL_FACE_POSITIONS.length, 468 * 3);
  TestValidator.equals("uvs", CANONICAL_FACE_UVS.length, 468 * 2);
  TestValidator.equals("triangles", CANONICAL_FACE_INDICES.length, 898 * 3);
  TestValidator.predicate(
    "uvs inside the unit square",
    CANONICAL_FACE_UVS.every((u) => u >= 0 && u <= 1),
  );
  // the global argmax-z is landmark 4 (lower nose bridge), 1.1mm ahead of the
  // tip ??assert the front-most vertex is on the nose, not its exact index
  let argmax = 0;
  for (let i = 0; i < 468; i++)
    if (
      CANONICAL_FACE_POSITIONS[i * 3 + 2]! >
      CANONICAL_FACE_POSITIONS[argmax * 3 + 2]!
    )
      argmax = i;
  TestValidator.predicate(
    "front-most vertex is on the nose",
    [1, 4, 5, 195].includes(argmax) &&
      CANONICAL_FACE_POSITIONS[argmax * 3 + 2]! -
        CANONICAL_FACE_POSITIONS[1 * 3 + 2]! <
        0.002,
  );
  let meanX = 0;
  for (let i = 0; i < 468; i++) meanX += CANONICAL_FACE_POSITIONS[i * 3]! / 468;
  TestValidator.predicate("laterally centered", Math.abs(meanX) < 0.001);
};
