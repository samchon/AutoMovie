import { bodyRegionBones } from "@autofilm/engine";
import { AutoFilmHumanoidBone } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

const disjoint = (
  a: AutoFilmHumanoidBone[],
  b: AutoFilmHumanoidBone[],
): boolean => {
  const set = new Set(a);
  return b.every((x) => !set.has(x));
};

/**
 * `bodyRegionBones` — the disjoint-and-complete partition of the humanoid
 * skeleton into body regions, the basis for layering clips on non-overlapping
 * regions.
 *
 * Scenarios:
 *
 * 1. Each region owns the expected bones (lower = hips+legs, upper = torso+arms+
 *    fingers, head = neck/head/eyes/jaw, face = none).
 * 2. The three bony regions are pairwise disjoint.
 * 3. They cover the full 55-bone VRM rig exactly — `fullBody` is their union.
 */
export const test_perform_body_region_bones = (): void => {
  const lower = bodyRegionBones("lowerBody");
  const upper = bodyRegionBones("upperBody");
  const head = bodyRegionBones("head");
  const face = bodyRegionBones("face");
  const full = bodyRegionBones("fullBody");

  // 1. membership
  TestValidator.equals("lowerBody owns 9 bones", lower.length, 9);
  TestValidator.predicate(
    "lowerBody has hips + a foot",
    lower.includes("hips") && lower.includes("leftFoot"),
  );
  TestValidator.equals("upperBody owns 41 bones", upper.length, 41);
  TestValidator.predicate(
    "upperBody has spine, a hand, a finger",
    upper.includes("spine") &&
      upper.includes("leftHand") &&
      upper.includes("rightLittleDistal"),
  );
  TestValidator.equals("head owns 5 bones", head.length, 5);
  TestValidator.predicate(
    "head has neck + jaw",
    head.includes("neck") && head.includes("jaw"),
  );
  TestValidator.equals("face owns no bones", face.length, 0);

  // 2. pairwise disjoint
  TestValidator.predicate("lower ∩ upper = ∅", disjoint(lower, upper));
  TestValidator.predicate("lower ∩ head = ∅", disjoint(lower, head));
  TestValidator.predicate("upper ∩ head = ∅", disjoint(upper, head));

  // 3. complete cover
  TestValidator.equals("fullBody is the whole 55-bone rig", full.length, 55);
  TestValidator.equals("fullBody has no duplicates", new Set(full).size, 55);
  TestValidator.equals(
    "fullBody is the union of the three regions",
    new Set(full).size,
    new Set([...lower, ...upper, ...head]).size,
  );
};
