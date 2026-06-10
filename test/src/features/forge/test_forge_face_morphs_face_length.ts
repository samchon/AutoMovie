import { CANONICAL_FACE_POSITIONS, buildFaceMorphs } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * `faceLength` stretches about the eye line: dy is affine in y with slope 0.09
 * (so dy − 0.09·y is one constant across all vertices) and x/z stay put —
 * checked as a property, without re-deriving the eye-line constant the builder
 * anchors on.
 *
 * Scenario: dy − 0.09·y has near-zero spread; dx = dz = 0 everywhere.
 */
export const test_forge_face_morphs_face_length = (): void => {
  const delta = buildFaceMorphs().faceLength;
  const residuals = Array.from(
    { length: 468 },
    (_, i) => delta[i * 3 + 1]! - 0.09 * CANONICAL_FACE_POSITIONS[i * 3 + 1]!,
  );
  const spread = Math.max(...residuals) - Math.min(...residuals);
  TestValidator.predicate("dy affine in y with slope 0.09", spread < 1e-9);
  TestValidator.predicate(
    "no lateral or depth motion",
    Array.from({ length: 468 }, (_, i) => i).every(
      (i) => delta[i * 3] === 0 && delta[i * 3 + 2] === 0,
    ),
  );
};
