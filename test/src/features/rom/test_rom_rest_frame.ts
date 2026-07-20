import { HUMANOID_REST_FRAME, restRelativeConstraint } from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const CLINICAL: IAutoMovieJointConstraint = {
  flexion: { min: -60, max: 180 },
  abduction: { min: -30, max: 180 },
  twist: null,
};

/**
 * `restRelativeConstraint`, shifting a clinical ROM into a rig's rest-relative
 * pose space via a per-axis `{ sign, neutral }` frame (clinical = sign·pose +
 * neutral).
 *
 * Scenarios:
 *
 * 1. Left-arm frame (sign +1, neutral 90): clinical abduction [−30,180] becomes
 *    rest-relative [−120, 90].
 * 2. Right-arm frame (sign −1, neutral 90): the same range mirrors and re-sorts to
 *    [−90, 120].
 * 3. An axis with no frame entry is untouched (flexion stays [−60,180]); a null
 *    clinical axis stays null (twist).
 * 4. `HUMANOID_REST_FRAME` mirrors the two shoulders' abduction.
 * 5. The `swingDeg` cone half-angle carries through unchanged (a deviation
 *    magnitude the neutral shift leaves invariant): present → preserved, `null`
 *    → `null`, absent → absent. Dropping it silenced the ball-joint cone on the
 *    very bones that carry a rest frame (the shoulders).
 */
export const test_rom_rest_frame = (): void => {
  // 1. sign +1
  const left = restRelativeConstraint(CLINICAL, {
    abduction: { sign: 1, neutral: 90 },
  });
  TestValidator.equals("left abduction shifted", left.abduction, {
    min: -120,
    max: 90,
  });

  // 2. sign −1 mirrors + re-sorts
  const right = restRelativeConstraint(CLINICAL, {
    abduction: { sign: -1, neutral: 90 },
  });
  TestValidator.equals("right abduction mirrored", right.abduction, {
    min: -90,
    max: 120,
  });

  // 3. no-frame axis untouched; null axis stays null
  TestValidator.equals("unframed flexion untouched", left.flexion, {
    min: -60,
    max: 180,
  });
  TestValidator.equals("null axis stays null", left.twist, null);

  // 3b. the CLINICAL fixture carries no cone → the reconciled constraint has none
  TestValidator.equals(
    "absent swingDeg stays absent",
    left.swingDeg,
    undefined,
  );

  // 4. the humanoid table mirrors the shoulders
  TestValidator.equals(
    "left shoulder frame",
    HUMANOID_REST_FRAME.leftUpperArm?.abduction,
    { sign: 1, neutral: 90 },
  );
  TestValidator.equals(
    "right shoulder mirrored",
    HUMANOID_REST_FRAME.rightUpperArm?.abduction,
    { sign: -1, neutral: 90 },
  );

  // 5. a shoulder cone (swingDeg 180) survives the neutral shift unchanged, and
  // a null cone stays null: the magnitude is a deviation the shift can't touch.
  const coned = restRelativeConstraint(
    { ...CLINICAL, swingDeg: 180 },
    { abduction: { sign: 1, neutral: 90 } },
  );
  TestValidator.equals("cone half-angle preserved", coned.swingDeg, 180);
  TestValidator.equals(
    "abduction still shifts under the cone",
    coned.abduction,
    { min: -120, max: 90 },
  );
  const nullCone = restRelativeConstraint(
    { ...CLINICAL, swingDeg: null },
    { abduction: { sign: 1, neutral: 90 } },
  );
  TestValidator.equals("null cone stays null", nullCone.swingDeg, null);
};
