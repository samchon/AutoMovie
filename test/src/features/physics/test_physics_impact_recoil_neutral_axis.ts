import { impactRecoil, validatePoseResult } from "@automovie/engine";
import {
  IAutoMovieBone,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const rest: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const bone = (
  name: IAutoMovieBone["bone"],
  parent: IAutoMovieBone["parent"],
  constraint: IAutoMovieBone["constraint"],
): IAutoMovieBone => ({ bone: name, parent, rest, constraint });

// An always-flexed elbow: its flexion AND abduction ROM both EXCLUDE 0.
const skeleton: IAutoMovieSkeleton = {
  id: "stiff-rig",
  bones: [
    bone("leftLowerArm", null, {
      flexion: { min: 10, max: 145 },
      abduction: { min: 5, max: 30 },
      twist: null,
    }),
  ],
};

/**
 * `impactRecoil` synthesizes only the motion the impact caused: an axis the
 * push never touches stays `null` (rest), even when the joint's ROM excludes 0.
 * Representing rest as the numeric angle 0 would make the ordinary validator
 * reject that zero-excluding joint; dragging it to the minimum would inject
 * motion the impact never produced (#710).
 *
 * Scenarios:
 *
 * 1. A twist-only push leaves flexion and abduction at `null`; the immobile twist
 *    axis itself is clamped to 0.
 * 2. A non-zero push on zero-excluding numeric ranges remains range-bound.
 * 3. `falloff` of 0 leaves a downstream link's flexion at `null`, not pinned to
 *    its ROM minimum.
 * 4. Each result passes the same pose validator that defines effective ROM.
 */
export const test_physics_impact_recoil_neutral_axis = (): void => {
  const pose = impactRecoil({ twist: 8 }, ["leftLowerArm"], skeleton, 1);
  const joint = pose.joints[0]!;
  TestValidator.equals(
    "un-pushed flexion stays at rest, not ROM min 10",
    joint.flexion,
    null,
  );
  TestValidator.equals(
    "un-pushed abduction stays at rest, not ROM min 5",
    joint.abduction,
    null,
  );
  TestValidator.predicate(
    "pushed immobile twist is forced back to neutral",
    nclose(joint.twist!, 0),
  );
  TestValidator.equals(
    "resting zero-excluding axes form a legal recoil pose",
    validatePoseResult(pose, skeleton),
    { success: true },
  );
  const explicitZero = impactRecoil(
    { flexion: 0 },
    ["leftLowerArm"],
    skeleton,
    1,
  );
  TestValidator.equals(
    "an explicit zero push uses the same resting representation",
    explicitZero.joints[0]!.flexion,
    null,
  );
  TestValidator.equals(
    "the explicit-zero recoil remains legal",
    validatePoseResult(explicitZero, skeleton),
    { success: true },
  );

  const pushed = impactRecoil(
    { flexion: 200, abduction: 1 },
    ["leftLowerArm"],
    skeleton,
    1,
  );
  const pushedJoint = pushed.joints[0]!;
  TestValidator.predicate(
    "over-range flexion push clamps to ROM max 145",
    nclose(pushedJoint.flexion!, 145),
  );
  TestValidator.predicate(
    "non-zero abduction below min clamps to ROM min 5",
    nclose(pushedJoint.abduction!, 5),
  );
  TestValidator.equals(
    "the explicit numeric recoil override remains legal",
    validatePoseResult(pushed, skeleton),
    { success: true },
  );

  const chainSkeleton: IAutoMovieSkeleton = {
    id: "stiff-rig",
    bones: [
      bone("leftLowerArm", null, {
        flexion: { min: 10, max: 145 },
        abduction: null,
        twist: null,
      }),
      bone("leftHand", "leftLowerArm", {
        flexion: { min: 10, max: 90 },
        abduction: null,
        twist: null,
      }),
    ],
  };
  const chain = impactRecoil(
    { flexion: 50 },
    ["leftLowerArm", "leftHand"],
    chainSkeleton,
    0,
  );
  TestValidator.predicate(
    "contact link pushed flexion 50 within ROM passes",
    nclose(chain.joints[0]!.flexion!, 50),
  );
  TestValidator.equals(
    "falloff-zeroed downstream flexion stays at rest, not ROM min 10",
    chain.joints[1]!.flexion,
    null,
  );
  TestValidator.equals(
    "the falloff-zeroed chain remains legal",
    validatePoseResult(chain, chainSkeleton),
    { success: true },
  );
};
