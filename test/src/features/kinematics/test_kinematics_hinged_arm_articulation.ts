import {
  clinicalDeviation,
  hingedArmArticulation,
  jointRomOvershoot,
} from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const AT_ORIGIN = {
  worldPosition: { x: 0, y: 0, z: 0 },
  worldRotation: IDENTITY,
};

/** A 0.3 + 0.25 chain along +X with a +Y hinge: the canonical arm, isolated. */
const chain = (overrides: {
  midOffset?: IAutoMovieVector3;
  endOffset?: IAutoMovieVector3;
  hinge?: IAutoMovieVector3;
  target: IAutoMovieVector3;
}) =>
  hingedArmArticulation({
    upper: AT_ORIGIN,
    midOffset: overrides.midOffset ?? { x: 0.3, y: 0, z: 0 },
    midRest: IDENTITY,
    endOffset: overrides.endOffset ?? { x: 0.25, y: 0, z: 0 },
    hinge: overrides.hinge ?? { x: 0, y: 1, z: 0 },
    target: overrides.target,
    score: () => ({ overshoot: 0, deviation: 0 }),
  });

/**
 * The shared hinge solve's own contract, exercised directly.
 *
 * `reachPose` guards several of these cases before they can be reached (it
 * refuses a faulted arm chain and always supplies the humanoid arm axes), so
 * the geometry's own boundaries need a caller that can actually present them.
 * That is what this file is: the algebra under test without the rig policy the
 * arm caller wraps it in.
 *
 * The expectations are geometric, not sampled. A `0.3 + 0.25` chain spans
 * `[0.05, 0.55]`, so a target at `0.55` is the straight arm, one at `0.05` is
 * the fully folded arm, and anything outside clamps to the nearer end.
 *
 * Scenarios:
 *
 * 1. A target inside the span solves, and the mid joint's delta is a rotation
 *    about the hinge alone, so its component off the hinge axis is zero.
 * 2. Boundary, past the span: a target at `2.0` clamps to the extended end, and
 *    the mid joint's rotation is the identity (a straight chain).
 * 3. Boundary, inside the fold: a target at `0.01`, nearer than the `0.05`
 *    minimum, clamps to the folded end instead of failing.
 * 4. Degenerate, a hinge parallel to the far segment: the mid joint cannot change
 *    the span at all, so there is no two-bone solve and the answer is `null`.
 *    This is #1346's arms-down rig reduced to its geometry.
 * 5. Degenerate, zero-length inputs: a zero mid offset, a zero end offset, a
 *    zero-length hinge, and a target on the chain root each return `null`.
 * 6. `jointRomOvershoot` totals a joint's ROM overshoot and answers `0` for an
 *    unconstrained joint; `clinicalDeviation` is the squared distance from the
 *    anatomical neutral.
 */
export const test_kinematics_hinged_arm_articulation = (): void => {
  // 1. an ordinary solve, and the hinge invariant at the quaternion level
  const solved = chain({ target: { x: 0.3, y: 0, z: 0.3 } });
  TestValidator.predicate("a target inside the span solves", solved !== null);
  if (solved !== null) {
    TestValidator.predicate(
      "the mid joint rotates about the hinge and nothing else",
      nclose(solved.lower.x, 0, 1e-12) && nclose(solved.lower.z, 0, 1e-12),
    );
    TestValidator.predicate(
      "and the scored overshoot rides back out",
      nclose(solved.overshoot, 0, 0),
    );
  }

  // 2. BOUNDARY: past the span, the chain straightens
  const far = chain({ target: { x: 2, y: 0, z: 0 } });
  TestValidator.predicate(
    "a target past the span clamps to the straight chain",
    far !== null && nclose(far.lower.w, 1, 1e-9),
  );

  // 3. BOUNDARY: nearer than the fold, the chain folds shut. Folding a `+0.25X`
  // far segment back onto a `+0.3X` near one is a half turn about the hinge, so
  // the delta is `(0, 1, 0, 0)`: `w = cos(180/2) = 0`.
  const near = chain({ target: { x: 0.01, y: 0, z: 0 } });
  TestValidator.predicate(
    "a target inside the fold clamps to the folded chain instead of failing",
    near !== null &&
      nclose(near.lower.w, 0, 1e-9) &&
      nclose(near.lower.y, 1, 1e-9),
  );

  // 4. DEGENERATE: the hinge lies along the far segment, so flexion is a roll
  TestValidator.equals(
    "a hinge parallel to the far segment has no two-bone solve",
    chain({ hinge: { x: 1, y: 0, z: 0 }, target: { x: 0.3, y: 0, z: 0.3 } }),
    null,
  );

  // 5. DEGENERATE: the zero-length inputs
  TestValidator.equals(
    "a zero mid offset returns null",
    chain({
      midOffset: { x: 0, y: 0, z: 0 },
      target: { x: 0.3, y: 0, z: 0.3 },
    }),
    null,
  );
  TestValidator.equals(
    "a zero end offset returns null",
    chain({
      endOffset: { x: 0, y: 0, z: 0 },
      target: { x: 0.3, y: 0, z: 0.3 },
    }),
    null,
  );
  TestValidator.equals(
    "a zero-length hinge returns null",
    chain({ hinge: { x: 0, y: 0, z: 0 }, target: { x: 0.3, y: 0, z: 0.3 } }),
    null,
  );
  TestValidator.equals(
    "a target on the chain root returns null",
    chain({ target: { x: 0, y: 0, z: 0 } }),
    null,
  );

  // 6. the two scoring helpers the arm caller composes its verdict from
  TestValidator.equals(
    "an unconstrained joint overshoots by nothing",
    jointRomOvershoot(
      { bone: "leftLowerArm", flexion: 900, abduction: 0, twist: 0 },
      null,
    ),
    0,
  );
  TestValidator.predicate(
    "a constrained joint totals the degrees it exceeds by",
    nclose(
      jointRomOvershoot(
        { bone: "leftLowerArm", flexion: 170, abduction: 12, twist: 0 },
        { flexion: { min: 0, max: 150 }, abduction: null, twist: null },
      ),
      32,
      1e-9,
    ),
  );
  TestValidator.predicate(
    "clinical deviation is the squared distance from the neutral",
    nclose(clinicalDeviation({ flexion: 3, abduction: 4, twist: 12 }), 169, 0),
  );
};
