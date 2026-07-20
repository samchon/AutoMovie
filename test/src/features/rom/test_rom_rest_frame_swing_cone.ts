import {
  ViolationCollector,
  clampJointRom,
  restRelativeConstraint,
  validateJointRom,
} from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** A shoulder-like clinical ball joint: axes wide, only the swing cone capping. */
const CLINICAL_SHOULDER: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: { min: -180, max: 180 },
  twist: null,
  swingDeg: 100,
};

/** The rig's rest frame: the shoulder sits at 30° abduction, this side +. */
const FRAME = { abduction: { sign: 1 as const, neutral: 30 } };

const passesCone = (
  j: ReturnType<typeof joint>,
  constraint: IAutoMovieJointConstraint,
): boolean => {
  const collector = new ViolationCollector();
  validateJointRom({ joint: j, constraint, path: "$input", collector });
  return collector.items.length === 0;
};

/**
 * The swing cone must survive rest-frame reconciliation.
 * `restRelativeConstraint` shifts each per-axis range into the rig's
 * rest-relative space; if it dropped `swingDeg` (the bug), the reconciled
 * ball-joint constraint would carry no cone and
 * `validateJointRom`/`clampJointRom` (which gate the cone on `swingDeg !=
 * null`) would silently stop bounding the corner a per-axis box over-permits.
 * This is exactly the shoulder, the one bone that carries a rest frame.
 *
 * Scenarios (all on the RECONCILED constraint, not the clinical one):
 *
 * 1. The cone half-angle carries through the shift unchanged (100°), while the
 *    framed abduction range actually shifts (proving reconciliation ran).
 * 2. A rest-relative corner pose (90°+90° = 120° of swing), inside both shifted
 *    per-axis boxes, is flagged once on the `.swing` path, overshoot 20°. On
 *    the swingDeg-dropping code this pose passed clean.
 * 3. `clampJointRom` against the reconciled constraint pulls the corner straight
 *    back onto the cone (ratio preserved), and the result now validates.
 */
export const test_rom_rest_frame_swing_cone = (): void => {
  const reconciled = restRelativeConstraint(CLINICAL_SHOULDER, FRAME);

  // 1. cone preserved through the shift; the framed axis genuinely shifted
  TestValidator.equals(
    "cone survives reconciliation",
    reconciled.swingDeg,
    100,
  );
  TestValidator.equals(
    "abduction shifted by the rest frame",
    reconciled.abduction,
    {
      min: -210,
      max: 150,
    },
  );

  // 2. a corner pose past the cone is caught BY the reconciled constraint
  const corner = joint("leftUpperArm", { flexion: 90, abduction: 90 });
  const collector = new ViolationCollector();
  validateJointRom({
    joint: corner,
    constraint: reconciled,
    path: "$input",
    collector,
  });
  TestValidator.equals(
    "reconciled cone flags the corner once",
    collector.items.length,
    1,
  );
  TestValidator.predicate(
    "flagged on the swing path",
    collector.items[0]!.path.endsWith(".swing"),
  );
  TestValidator.predicate(
    "overshoot is 120 − 100 = 20°",
    nclose(collector.items[0]!.overshoot!, 20),
  );

  // 3. clamp against the reconciled constraint pulls it back onto the cone
  const clamped = clampJointRom(corner, reconciled);
  TestValidator.predicate("flexion pulled in below 90", clamped.flexion! < 90);
  TestValidator.predicate(
    "1:1 swing direction preserved",
    nclose(clamped.flexion!, clamped.abduction!),
  );
  TestValidator.predicate(
    "clamped pose now passes the reconciled cone",
    passesCone(clamped, reconciled),
  );
};
