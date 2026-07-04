import { CANONICAL_FACE_POSITIONS, buildFaceMorphs } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * `eyeSizeR` is local and radial: on the right eyelid ring every delta points
 * away from that eye's center (positive dot with the radial direction ??the eye
 * ENLARGES at +1), while a far vertex (the chin) stays put ??pinning both the
 * gaussian locality and the sign convention.
 *
 * Scenario: all 16 right-ring deltas radial-positive; chin delta exactly zero.
 */
export const test_forge_face_morphs_eye_size = (): void => {
  const EYE_R = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  ];
  const delta = buildFaceMorphs().eyeSizeR;
  const c = [0, 0];
  for (const i of EYE_R) {
    c[0] += CANONICAL_FACE_POSITIONS[i * 3]! / EYE_R.length;
    c[1] += CANONICAL_FACE_POSITIONS[i * 3 + 1]! / EYE_R.length;
  }
  TestValidator.predicate(
    "ring deltas point outward",
    EYE_R.every(
      (i) =>
        delta[i * 3]! * (CANONICAL_FACE_POSITIONS[i * 3]! - c[0]!) +
          delta[i * 3 + 1]! * (CANONICAL_FACE_POSITIONS[i * 3 + 1]! - c[1]!) >
        0,
    ),
  );
  TestValidator.equals(
    "chin untouched",
    [delta[152 * 3], delta[152 * 3 + 1], delta[152 * 3 + 2]],
    [0, 0, 0],
  );
};
