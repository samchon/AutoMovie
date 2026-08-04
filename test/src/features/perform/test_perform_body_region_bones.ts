import { bodyRegionBones } from "@automovie/engine";
import { AutoMovieHumanoidBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const disjoint = (
  a: readonly AutoMovieHumanoidBone[],
  b: readonly AutoMovieHumanoidBone[],
): boolean => {
  const set = new Set(a);
  return b.every((x) => !set.has(x));
};

/**
 * `bodyRegionBones`: the disjoint-and-complete partition of the humanoid
 * skeleton into body regions, the basis for layering clips on non-overlapping
 * regions.
 *
 * Completeness is not asserted here, and the count below is documentation
 * rather than proof. This scenario used to claim the three regions "cover the
 * full 55-bone VRM rig exactly" while comparing them only with each other, so a
 * bone added to the union and to no region kept every assertion green while
 * every mask stripped it (#1400). The claim now belongs to the compiler:
 * `AUTOMOVIE_RIG_IS_PARTITIONED` types as `true` only while the partition
 * covers `AutoMovieHumanoidBone`, and an escaped bone fails the build by name.
 * What is left for run time is what a type cannot see: disjointness, the empty
 * face region, and `fullBody` really being the three concatenated.
 *
 * Scenarios:
 *
 * 1. Each region owns the expected bones (lower = hips+legs, upper = torso+arms+
 *    fingers, head = neck/head/eyes/jaw, face = none).
 * 2. The three bony regions are pairwise disjoint.
 * 3. `fullBody` is exactly their concatenation, element for element. Nothing here
 *    asserts completeness: an assertion that cannot fail is not a guard, and
 *    `AUTOMOVIE_RIG_IS_PARTITIONED` is a type, checked when the engine builds.
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
  TestValidator.equals(
    "upperBody has spine, a hand, a finger",
    namedFacts([
      ["upperSpine", () => upper.includes("spine")],
      ["upperLeftHand", () => upper.includes("leftHand")],
      ["upperRightLittleDistal", () => upper.includes("rightLittleDistal")],
    ]),
    {
      upperSpine: true,
      upperLeftHand: true,
      upperRightLittleDistal: true,
    },
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

  // 3. fullBody is the three regions, and the build proved they are all of them
  TestValidator.equals(
    "fullBody is the three regions concatenated",
    [...full],
    [...lower, ...upper, ...head],
  );
  TestValidator.equals("fullBody has no duplicates", new Set(full).size, 55);
};
