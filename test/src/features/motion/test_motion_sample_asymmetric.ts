import { sampleMotion } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  joint,
  keyframe,
  makeExpression,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const shift = (x: number): IAutoMovieTransform => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * Interpolation must handle keyframes whose joint axes, root transform, and
 * expression are present on one side but not the other — the asymmetric cases a
 * uniform clip never produces. Each interpolation helper treats a missing value
 * as its neutral (an absent angle as 0, an absent root as identity) and an
 * absent expression by carrying the present one through.
 *
 * Scenarios (forward clip, sampled at t=0.5):
 *
 * 1. Flexion present on both keyframes (0→120) → 60.
 * 2. Abduction absent at the start, 10 at the end → 5 (missing treated as 0).
 * 3. Twist 5 at the start, absent at the end → 2.5 (missing treated as 0).
 * 4. Root absent at the start, +1 at the end → +0.5 (missing treated as identity).
 * 5. Expression present at the start, absent at the end → the start expression is
 *    carried through.
 *
 * Then a reversed clip covers the mirror branches (root present→absent → +1.0
 * from shift(2); expression absent→present → the end expression carries), and a
 * both-roots-present clip covers the ordinary transform blend (shift 0→2 →
 * 1.0).
 */
export const test_motion_sample_asymmetric = (): void => {
  const forward = makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerArm", { flexion: 0, twist: 5 })]),
        "linear",
        makeExpression("happy", 1),
      ),
      keyframe(
        1,
        makePose(
          [joint("leftLowerArm", { flexion: 120, abduction: 10 })],
          shift(1),
        ),
        "linear",
        null,
      ),
    ],
    1,
  );
  const f = sampleMotion(forward, 0.5);
  const fj = f.pose.joints.find((j) => j.bone === "leftLowerArm")!;
  TestValidator.predicate(
    "flexion both-present → 60",
    nclose(fj.flexion ?? NaN, 60),
  );
  TestValidator.predicate(
    "abduction absent→10 → 5",
    nclose(fj.abduction ?? NaN, 5),
  );
  TestValidator.predicate("twist 5→absent → 2.5", nclose(fj.twist ?? NaN, 2.5));
  TestValidator.predicate(
    "root absent→present → 0.5",
    f.pose.root !== null && nclose(f.pose.root.translation.x, 0.5),
  );
  TestValidator.equals(
    "expression present→absent carries first",
    f.expression?.preset,
    "happy",
  );

  const reversed = makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerArm", { flexion: 120 })], shift(2)),
        "linear",
        null,
      ),
      keyframe(
        1,
        makePose([joint("leftLowerArm", { flexion: 0 })]),
        "linear",
        makeExpression("angry", 1),
      ),
    ],
    1,
  );
  const r = sampleMotion(reversed, 0.5);
  TestValidator.predicate(
    "root present→absent → 1.0",
    r.pose.root !== null && nclose(r.pose.root.translation.x, 1),
  );
  TestValidator.equals(
    "expression absent→present carries second",
    r.expression?.preset,
    "angry",
  );

  const bothRoots = makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerArm", { flexion: 0 })], shift(0)),
        "linear",
        null,
      ),
      keyframe(
        1,
        makePose([joint("leftLowerArm", { flexion: 0 })], shift(2)),
        "linear",
        null,
      ),
    ],
    1,
  );
  const b = sampleMotion(bothRoots, 0.5);
  TestValidator.predicate(
    "both roots present → midpoint 1.0",
    b.pose.root !== null && nclose(b.pose.root.translation.x, 1),
  );

  // axes present on opposite keyframes: abduction only at the start, twist only
  // at the end (mirrors scenarios 2–3 onto the other side of each blend).
  const axisSwap = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { abduction: 8 })])),
      keyframe(1, makePose([joint("leftLowerArm", { twist: 6 })])),
    ],
    1,
  );
  const a = sampleMotion(axisSwap, 0.5);
  const aj = a.pose.joints.find((j) => j.bone === "leftLowerArm")!;
  TestValidator.predicate(
    "start-only abduction 8→absent → 4",
    nclose(aj.abduction ?? NaN, 4),
  );
  TestValidator.predicate(
    "end-only twist absent→6 → 3",
    nclose(aj.twist ?? NaN, 3),
  );
};
