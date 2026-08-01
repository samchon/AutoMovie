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

// Spine overrides its ROM; chest falls back to the normalized humanoid table.
const skeleton: IAutoMovieSkeleton = {
  id: "recoil-rig",
  bones: [
    bone("spine", null, {
      flexion: { min: -30, max: 40 },
      abduction: { min: -15, max: 15 },
      twist: { min: -20, max: 20 },
    }),
    bone("chest", "spine", null),
  ],
};

/**
 * `impactRecoil`: the reactive `push` propagates down a bone chain (losing
 * strength by `falloff` per link), and each joint yields only within its ROM.
 *
 * Scenarios:
 *
 * 1. Huge flexion and abduction pushes clamp to the contact bone's explicit ROM
 *    maxima (40° and 15°), while a twist push within range passes.
 * 2. `falloff` weakens the push down the chain, and a null-override canonical
 *    chest is clamped by the same default humanoid ROM `validatePose` uses.
 * 3. A bone absent from the skeleton has no constraint, so its axis is unclamped.
 * 4. The generated recoil pose passes the ordinary pose validator, proving the
 *    producer and validator share one effective-ROM calculation.
 */
export const test_physics_impact_recoil = (): void => {
  const pose = impactRecoil(
    { flexion: 200, abduction: 100, twist: 10 },
    ["spine", "chest"],
    skeleton,
    0.6,
  );
  const spine = pose.joints.find((j) => j.bone === "spine")!;
  const chest = pose.joints.find((j) => j.bone === "chest")!;

  // 1. clamped to ROM at the contact joint; unclamped twist within range
  TestValidator.predicate(
    "spine flexion clamped to ROM max 40",
    nclose(spine.flexion!, 40),
  );
  TestValidator.predicate(
    "spine abduction clamped to ROM max 15",
    nclose(spine.abduction!, 15),
  );
  TestValidator.predicate(
    "spine twist within range passes",
    nclose(spine.twist!, 10),
  );

  // 2. falloff down the chain; null override uses the default chest ROM.
  TestValidator.predicate(
    "chest flexion clamps to the default humanoid maximum",
    nclose(chest.flexion!, 40),
  );
  TestValidator.predicate(
    "chest abduction clamps to the default humanoid maximum",
    nclose(chest.abduction!, 25),
  );

  // 2b. a push past the lower ROM bound clamps to the joint minimum
  const back = impactRecoil({ flexion: -200 }, ["spine"], skeleton, 1);
  TestValidator.predicate(
    "spine flexion clamped to ROM min −30",
    nclose(back.joints[0]!.flexion!, -30),
  );

  // 3. a bone not in the skeleton is unconstrained
  const off = impactRecoil({ abduction: 15 }, ["leftHand"], skeleton, 0.6);
  TestValidator.predicate(
    "unknown bone unclamped",
    nclose(off.joints[0]!.abduction!, 15),
  );
  TestValidator.equals(
    "pose carries the skeleton id",
    pose.skeleton,
    "recoil-rig",
  );
  TestValidator.equals(
    "the generated recoil pose is legal under the same skeleton",
    validatePoseResult(pose, skeleton),
    { success: true },
  );
};
