import { impactRecoil } from "@automovie/engine";
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
 * push never touches (value 0) stays neutral, even when the joint's ROM
 * excludes 0. The old `clampAxis` dragged such an un-pushed axis to its lower
 * bound (0 → min), injecting spurious flexion the flinch never produced
 * (#710).
 *
 * Scenarios (a joint whose flexion/abduction ROM both exclude 0):
 *
 * 1. A twist-only push leaves flexion and abduction un-pushed (value 0): they stay
 *    neutral, not dragged to ROM min 10 / 5.
 * 2. A non-zero push on the same 0-excluding ROM is still bound to the range
 *    (over-range flexion → max; a below-min abduction push → min).
 * 3. `falloff` of 0 zeroes a downstream link's push, so that link stays neutral
 *    too, not pinned to its ROM min.
 */
export const test_physics_impact_recoil_neutral_axis = (): void => {
  // 1. twist push only; flexion & abduction get no push (value 0)
  const pose = impactRecoil({ twist: 8 }, ["leftLowerArm"], skeleton, 1);
  const joint = pose.joints[0]!;
  TestValidator.predicate(
    "un-pushed flexion stays neutral, not dragged to ROM min 10",
    nclose(joint.flexion!, 0),
  );
  TestValidator.predicate(
    "un-pushed abduction stays neutral, not dragged to ROM min 5",
    nclose(joint.abduction!, 0),
  );
  TestValidator.predicate(
    "pushed twist (no ROM) passes through",
    nclose(joint.twist!, 8),
  );

  // 2. a non-zero push on the same 0-excluding ROM stays range-bound
  const pushed = impactRecoil(
    { flexion: 200, abduction: 1 },
    ["leftLowerArm"],
    skeleton,
    1,
  );
  const pj = pushed.joints[0]!;
  TestValidator.predicate(
    "over-range flexion push clamps to ROM max 145",
    nclose(pj.flexion!, 145),
  );
  TestValidator.predicate(
    "in-push abduction below min clamps to ROM min 5",
    nclose(pj.abduction!, 5),
  );

  // 3. falloff 0 → the downstream link's push is 50 × 0¹ = 0 → neutral, not min 10
  const chain = impactRecoil(
    { flexion: 50 },
    ["leftLowerArm", "leftHand"],
    {
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
    },
    0,
  );
  TestValidator.predicate(
    "contact link pushed flexion 50 within ROM passes",
    nclose(chain.joints[0]!.flexion!, 50),
  );
  TestValidator.predicate(
    "falloff-zeroed downstream flexion stays neutral, not ROM min 10",
    nclose(chain.joints[1]!.flexion!, 0),
  );
};
