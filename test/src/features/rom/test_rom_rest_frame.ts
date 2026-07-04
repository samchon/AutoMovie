import { HUMANOID_REST_FRAME, restRelativeConstraint } from "@automovie/engine";
import { IautomovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const CLINICAL: IautomovieJointConstraint = {
  flexion: { min: -60, max: 180 },
  abduction: { min: -30, max: 180 },
  twist: null,
};

/**
 * `restRelativeConstraint` ??shifting a clinical ROM into a rig's rest-relative
 * pose space via a per-axis `{ sign, neutral }` frame (clinical = sign쨌pose +
 * neutral).
 *
 * Scenarios:
 *
 * 1. Left-arm frame (sign +1, neutral 90): clinical abduction [??0,180] becomes
 *    rest-relative [??20, 90].
 * 2. Right-arm frame (sign ??, neutral 90): the same range mirrors and re-sorts to
 *    [??0, 120].
 * 3. An axis with no frame entry is untouched (flexion stays [??0,180]); a null
 *    clinical axis stays null (twist).
 * 4. `HUMANOID_REST_FRAME` mirrors the two shoulders' abduction.
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

  // 2. sign ?? mirrors + re-sorts
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
};
