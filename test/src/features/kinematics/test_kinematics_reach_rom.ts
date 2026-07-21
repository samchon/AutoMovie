import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  reachPose,
  resolvePose,
  validatePoseResult,
} from "@automovie/engine";
import {
  IAutoMovieJointConstraint,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { nclose, vclose, violationCount } from "../internal/predicates";

const SHOULDER: IAutoMovieVector3 = { x: 0.2, y: 1.4, z: 0 };

/** Where the left hand lands, read back through the frame the pose is in. */
const handAt = (
  skeleton: IAutoMovieSkeleton,
  pose: NonNullable<ReturnType<typeof reachPose>>,
): IAutoMovieVector3 =>
  resolvePose(pose, skeleton, HUMANOID_JOINT_AXES, HUMANOID_REST_FRAME).find(
    (b) => b.bone === "leftHand",
  )!.worldPosition;

/**
 * The five targets #1345 established a ROM-valid witness for by grid search,
 * plus the two whose existence the search could NOT establish (it plateaued at
 * ~98% of full extension with residuals of 2.5 mm and 1.7 mm). All seven are
 * inside the 0.55 m shell and all seven used to come back ROM-violating.
 */
const WITNESSED: IAutoMovieVector3[] = [
  { x: 0.4, y: 1.2, z: 0.35 },
  { x: 0.3, y: 0.9, z: 0.1 },
  { x: -0.1, y: 1.3, z: 0.2 },
  { x: 0.35, y: 1.7, z: 0.05 },
  { x: 0.25, y: 1.6, z: 0.3 },
];
const UNESTABLISHED: IAutoMovieVector3[] = [
  { x: 0.4, y: 1.0, z: 0.3 },
  { x: 0.3, y: 1.05, z: 0.4 },
];

/**
 * A fused elbow: the hinge exists but is pinned shut, so the chain has one
 * span.
 */
const FUSED: IAutoMovieJointConstraint = {
  flexion: { min: 0, max: 0 },
  abduction: null,
  twist: null,
};

const withElbow = (
  constraint: IAutoMovieJointConstraint,
): IAutoMovieSkeleton => {
  const skeleton = createSkeleton();
  return {
    ...skeleton,
    bones: skeleton.bones.map((bone) =>
      bone.bone === "leftLowerArm" ? { ...bone, constraint } : bone,
    ),
  };
};

/**
 * `reachPose` must return a pose the rig can actually hold (#1345).
 *
 * The analytic solve used to articulate the mid joint as a free swing,
 * `aimRotation(localFore, localGoal)`, which generically decomposes into
 * abduction and twist. An elbow declares those axes immobile, so the pose was
 * illegal BY CONSTRUCTION, and the bend plane came from a world-down pole that
 * is right for a knee and bends an elbow backwards. On the canonical humanoid
 * under the engine's own `DEFAULT_HUMANOID_ROM`, exactly one of eight targets
 * came back ROM-clean and that one was the rest pose itself, while a grid
 * search proved valid poses exist for five of the seven failures.
 *
 * The expectations here are taken from the CONTRACT, never from what the solver
 * emits: an elbow's immobile axes must read exactly `0` because that is what
 * `IAutoMovieJointConstraint` means by a `null` axis, the hand must land on the
 * target because that is what an IK solve is for, and the verdict is
 * `validatePose`'s own, so the solver cannot grade itself by a kinder rule than
 * its gate.
 *
 * Scenarios:
 *
 * 1. Positive: each of the five witnessed targets returns a pose `validatePose`
 *    accepts with zero violations, and the hand lands within 1e-4 m.
 * 2. The hinge invariant, which is the mechanism rather than the symptom: the
 *    elbow's abduction and twist are EXACTLY zero for every one of those poses,
 *    so the axes an elbow does not have carry no rotation at all.
 * 3. The two targets the existence search could not settle are also clean, so the
 *    fix is not scoped to the rows that had a witness.
 * 4. Boundary, the rest-pose target: the identity articulation, zero violations,
 *    with the shoulder reading its clinical rest of 90 degrees abduction.
 * 5. Boundary, out of shell: a target four times the arm's length lands the hand
 *    on the 0.55 m shell along the shoulder-to-target ray, still ROM-clean.
 * 6. NEGATIVE TWIN: a fused elbow (`flexion` pinned to `[0, 0]`) cannot reach a
 *    target off its one span, so the verdict is still a refusal with the
 *    flexion axis named. The gate did not become permissive.
 */
export const test_kinematics_reach_rom = (): void => {
  const skeleton = createSkeleton();

  // 1 + 2. every witnessed target is clean, and clean for the right reason
  for (const target of WITNESSED) {
    const pose = reachPose(skeleton, "left", target);
    TestValidator.predicate(
      `reach ${JSON.stringify(target)} poses`,
      pose !== null,
    );
    if (pose === null) continue;
    TestValidator.equals(
      `reach ${JSON.stringify(target)} satisfies the rig's ROM`,
      violationCount(validatePoseResult(pose, skeleton)),
      0,
    );
    TestValidator.predicate(
      `and the hand lands on ${JSON.stringify(target)}`,
      vclose(handAt(skeleton, pose), target, 1e-4),
    );
    // Zero tolerance, so this is an exact assertion, but written through
    // `nclose` because the decomposition yields a signed zero on the abduction
    // axis and `-0` is numerically the required 0.
    const elbow = pose.joints.find((j) => j.bone === "leftLowerArm")!;
    TestValidator.predicate(
      `the elbow abducts exactly 0 for ${JSON.stringify(target)}`,
      nclose(elbow.abduction!, 0, 0),
    );
    TestValidator.predicate(
      `the elbow twists exactly 0 for ${JSON.stringify(target)}`,
      nclose(elbow.twist!, 0, 0),
    );
  }

  // 3. the rows the existence proof could not reach are not a separate class
  for (const target of UNESTABLISHED) {
    const pose = reachPose(skeleton, "left", target)!;
    TestValidator.equals(
      `the unwitnessed target ${JSON.stringify(target)} is clean too`,
      violationCount(validatePoseResult(pose, skeleton)),
      0,
    );
    TestValidator.predicate(
      `and its hand lands on ${JSON.stringify(target)}`,
      vclose(handAt(skeleton, pose), target, 1e-4),
    );
  }

  // 4. BOUNDARY: the rest pose target is the identity articulation. The
  // shoulder's clinical rest is 90 degrees of abduction (a T-pose arm is
  // already abducted), which is what HUMANOID_REST_FRAME's neutral states.
  const restTarget: IAutoMovieVector3 = { x: 0.75, y: 1.4, z: 0 };
  const rest = reachPose(skeleton, "left", restTarget)!;
  const restUpper = rest.joints.find((j) => j.bone === "leftUpperArm")!;
  const restLower = rest.joints.find((j) => j.bone === "leftLowerArm")!;
  TestValidator.predicate(
    "the rest-pose target returns the identity articulation",
    nclose(restUpper.flexion!, 0, 0) &&
      nclose(restUpper.abduction!, 90, 0) &&
      nclose(restUpper.twist!, 0, 0) &&
      nclose(restLower.flexion!, 0, 0) &&
      nclose(restLower.abduction!, 0, 0) &&
      nclose(restLower.twist!, 0, 0),
  );
  TestValidator.equals(
    "and it is ROM-clean",
    violationCount(validatePoseResult(rest, skeleton)),
    0,
  );

  // 5. BOUNDARY: past the shell, the arm extends along the ray and stops on it.
  const far: IAutoMovieVector3 = { x: 0.2, y: 3.6, z: 0 };
  const farPose = reachPose(skeleton, "left", far)!;
  const ray = {
    x: far.x - SHOULDER.x,
    y: far.y - SHOULDER.y,
    z: far.z - SHOULDER.z,
  };
  const length = Math.hypot(ray.x, ray.y, ray.z);
  TestValidator.predicate(
    "an unreachable target stops the hand on the 0.55 m shell",
    vclose(
      handAt(skeleton, farPose),
      {
        x: SHOULDER.x + (ray.x / length) * 0.55,
        y: SHOULDER.y + (ray.y / length) * 0.55,
        z: SHOULDER.z + (ray.z / length) * 0.55,
      },
      1e-4,
    ),
  );
  TestValidator.equals(
    "and the extended pose is still one the rig can hold",
    violationCount(validatePoseResult(farPose, skeleton)),
    0,
  );

  // 6. NEGATIVE TWIN: a rig that genuinely cannot hold the pose is still
  // refused, and refused at the axis that refuses it.
  const fusedRig = withElbow(FUSED);
  const fused = reachPose(fusedRig, "left", WITNESSED[0]!)!;
  const fusedResult = validatePoseResult(fused, fusedRig);
  TestValidator.predicate(
    "a fused elbow still fails the ROM gate, naming its flexion",
    fusedResult.success === false &&
      fusedResult.violations.some(
        (v) => v.kind === "rom" && v.path.endsWith(".flexion"),
      ),
  );
};
