import {
  IAutoMovieAxisFrame,
  restRelativeConstraint,
  toClinicalAngle,
  toRigAngle,
} from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const CLINICAL: IAutoMovieJointConstraint = {
  flexion: { min: -60, max: 180 },
  abduction: { min: -30, max: 180 },
  twist: null,
};

const badSign: IAutoMovieAxisFrame = { sign: 0 as 1, neutral: 90 };
const badNeutral: IAutoMovieAxisFrame = {
  sign: 1,
  neutral: Number.NaN,
};

/**
 * Rest-frame scalars are runtime inputs whenever callers provide custom rig
 * frames. Invalid signs or neutrals must stop before they create non-finite
 * clinical/rig angles or shifted ROM ranges.
 *
 * Scenarios:
 *
 * 1. `toRigAngle` rejects invalid frame signs.
 * 2. `toClinicalAngle` rejects non-finite neutrals.
 * 3. `restRelativeConstraint` rejects invalid frame entries before shifting.
 * 4. Omitted frames and null angles remain identity cases.
 */
export const test_rom_rest_frame_scalars = (): void => {
  TestValidator.predicate(
    "toRigAngle rejects invalid sign",
    throwsError(
      () => toRigAngle(150, badSign),
      ["rest frame sign", "1 or -1", "0"],
    ),
  );

  TestValidator.predicate(
    "toClinicalAngle rejects non-finite neutral",
    throwsError(
      () => toClinicalAngle(-60, badNeutral),
      ["rest frame neutral", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "restRelativeConstraint rejects invalid sign",
    throwsError(
      () => restRelativeConstraint(CLINICAL, { abduction: badSign }),
      ["rest frame abduction sign", "1 or -1", "0"],
    ),
  );

  TestValidator.predicate(
    "restRelativeConstraint rejects non-finite neutral",
    throwsError(
      () => restRelativeConstraint(CLINICAL, { flexion: badNeutral }),
      ["rest frame flexion neutral", "finite", "NaN"],
    ),
  );

  TestValidator.equals("no frame is identity", toRigAngle(12, undefined), 12);
  TestValidator.equals(
    "null angle is identity",
    toClinicalAngle(null, { sign: -1, neutral: 90 }),
    null,
  );
};
