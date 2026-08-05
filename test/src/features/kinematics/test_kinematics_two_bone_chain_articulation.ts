import { twoBoneChainArticulation } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

const at = (position: IAutoMovieVector3) => ({
  worldPosition: position,
  worldRotation: IDENTITY,
});

/** A 0.3 + 0.25 chain hanging straight down from the origin, like a leg. */
const leg = (overrides: {
  upper?: IAutoMovieVector3;
  lower?: IAutoMovieVector3;
  end?: IAutoMovieVector3;
  target: IAutoMovieVector3;
  bendNormal?: IAutoMovieVector3;
}) =>
  twoBoneChainArticulation({
    upper: at(overrides.upper ?? { x: 0, y: 0, z: 0 }),
    lower: at(overrides.lower ?? { x: 0, y: -0.3, z: 0 }),
    end: overrides.end ?? { x: 0, y: -0.55, z: 0 },
    target: overrides.target,
    ...(overrides.bendNormal === undefined
      ? {}
      : { bendNormal: overrides.bendNormal }),
  });

/**
 * The shared two-bone lowering's own boundaries, pinned directly.
 *
 * This function is the LEG chain's solver: `legPlant`'s ground-IK pass and the
 * retarget contact pass are its callers. It used to have a third, `reachPose`,
 * whose tests incidentally covered its degenerate paths; #1345 moved the arm
 * onto a hinge-respecting solve, so those paths lost the caller that reached
 * them. Depending on a leg scenario to wander through a zero-length segment is
 * exactly the accidental coverage the project forbids, so the contract is
 * stated here where it can be read.
 *
 * The arm's departure changed nothing about this function; that is the
 * regression these cases hold. The world-down pole and its fallback are still
 * right for a knee, which is why they stayed.
 *
 * Scenarios:
 *
 * 1. An ordinary reachable target solves, and the lowered deltas are unit
 *    quaternions.
 * 2. The pole fallback: a target straight below the root makes the reach axis
 *    parallel to the world-down pole, so the bend-plane cross product
 *    degenerates and a second reference (+Z) takes over. The solve stays total
 *    rather than dividing by a zero-length normal.
 * 3. An explicit `bendNormal` overrides the pole derivation, and its two signs are
 *    the chain's two bend branches, so they do not produce the same answer.
 * 4. Degenerate: a zero-length upper segment, a zero-length lower segment, and a
 *    target coincident with the chain root each return `null`.
 */
export const test_kinematics_two_bone_chain_articulation = (): void => {
  // 1. an ordinary solve
  const solved = leg({ target: { x: 0.2, y: -0.4, z: 0.1 } });
  TestValidator.predicate(
    "a reachable target solves into two unit deltas",
    solved !== null &&
      nclose(
        Math.hypot(
          solved.upper.x,
          solved.upper.y,
          solved.upper.z,
          solved.upper.w,
        ),
        1,
        1e-9,
      ) &&
      nclose(
        Math.hypot(
          solved.lower.x,
          solved.lower.y,
          solved.lower.z,
          solved.lower.w,
        ),
        1,
        1e-9,
      ),
  );

  // 2. the pole fallback: reach axis parallel to world-down
  TestValidator.predicate(
    "a straight-down target still solves through the bend-plane fallback",
    leg({ target: { x: 0, y: -0.5, z: 0 } }) !== null,
  );

  // 3. an explicit bend normal overrides the pole, and its sign picks a branch
  const plus = leg({
    target: { x: 0.2, y: -0.4, z: 0.1 },
    bendNormal: { x: 1, y: 0, z: 0 },
  });
  const minus = leg({
    target: { x: 0.2, y: -0.4, z: 0.1 },
    bendNormal: { x: -1, y: 0, z: 0 },
  });
  TestValidator.predicate(
    "the two hinge branches are genuinely different solves",
    plus !== null &&
      minus !== null &&
      !nclose(plus.upper.x, minus.upper.x, 1e-6),
  );

  // 4. the degenerate chains
  TestValidator.equals(
    "a zero-length upper segment returns null",
    leg({ lower: { x: 0, y: 0, z: 0 }, target: { x: 0.2, y: -0.4, z: 0.1 } }),
    null,
  );
  TestValidator.equals(
    "a zero-length lower segment returns null",
    leg({
      lower: { x: 0, y: -0.3, z: 0 },
      end: { x: 0, y: -0.3, z: 0 },
      target: { x: 0.2, y: -0.4, z: 0.1 },
    }),
    null,
  );
  TestValidator.equals(
    "a target on the chain root returns null",
    leg({ target: { x: 0, y: 0, z: 0 } }),
    null,
  );
};
