import { CANONICAL_FACE_POSITIONS, buildFaceMorphs } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * `faceWidth` is the one analytically exact morph — dx = 0.07·x with no y/z
 * motion — so it pins the builder's delta layout (xyz interleaving, vertex
 * alignment) against the spec's arithmetic rather than against the code.
 *
 * Scenario: explicit canonical positions in; every vertex's delta equals
 * (0.07·x, 0, 0).
 */
export const test_forge_face_morphs_face_width = (): void => {
  const delta = buildFaceMorphs(CANONICAL_FACE_POSITIONS).faceWidth;
  TestValidator.predicate(
    "dx = 0.07·x, dy = dz = 0",
    Array.from({ length: 468 }, (_, i) => i).every(
      (i) =>
        nclose(delta[i * 3]!, 0.07 * CANONICAL_FACE_POSITIONS[i * 3]!) &&
        delta[i * 3 + 1] === 0 &&
        delta[i * 3 + 2] === 0,
    ),
  );
};
