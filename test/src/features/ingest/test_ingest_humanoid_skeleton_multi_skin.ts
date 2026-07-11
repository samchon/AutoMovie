import { humanoidSkeleton } from "@automovie/ingest";
import { IAutoMovieBone } from "@automovie/interface";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

const bonesOf = (bones: IAutoMovieBone[]): string[] =>
  bones.map((b) => b.bone).sort((a, b) => a.localeCompare(b));

/**
 * Multi-skin documents map humanoid slots over EVERY skin's joints, not only
 * `skins[0]` (#1104): exporters bind clothes/hair as their own skins with no
 * ordering guarantee, so the body rig must be found wherever it sits. The union
 * is first-wins per slot in document order, and single-skin behavior is
 * untouched.
 *
 * Scenarios:
 *
 * 1. An accessory-first document (skin "cloth" holds only an unmapped `Button`,
 *    skin "body" holds `Hips → Spine`) still yields the body skeleton — before
 *    the fix `skins[0]` had no hips and the whole character demoted to `null`.
 * 2. Negative twin: the SAME joints with the body skin first yield the identical
 *    skeleton, pinning order independence.
 * 3. Complementary partial skins union: skin one maps `Hips`, skin two maps
 *    `Spine` (sharing the hips joint), and the emitted skeleton carries both
 *    slots with `spine` parenting `hips` across the skin boundary.
 * 4. First-wins across skins: when two skins name DIFFERENT nodes `Spine`, the
 *    earlier skin's node owns the slot — the later duplicate is dropped,
 *    matching the single-skin duplicate rule.
 */
export const test_ingest_humanoid_skeleton_multi_skin = (): void => {
  // 1. accessory skin first — the body rig sits in the second skin
  const accessoryFirst = new Document();
  const button = accessoryFirst.createNode("Button");
  const aHips = accessoryFirst.createNode("Hips").setTranslation([0, 1, 0]);
  const aSpine = accessoryFirst.createNode("Spine").setTranslation([0, 0.2, 0]);
  aHips.addChild(aSpine);
  aHips.addChild(button);
  accessoryFirst.createSkin("cloth").addJoint(button);
  accessoryFirst.createSkin("body").addJoint(aHips).addJoint(aSpine);
  accessoryFirst.createScene().addChild(aHips);
  const accessorySkel = humanoidSkeleton(accessoryFirst, "acc");
  if (accessorySkel === null)
    throw new Error("accessory-first document must still yield the body rig");
  TestValidator.equals(
    "accessory-first document maps the body skin's bones",
    bonesOf(accessorySkel.bones),
    ["hips", "spine"],
  );

  // 2. negative twin: body skin first — identical result
  const bodyFirst = new Document();
  const bButton = bodyFirst.createNode("Button");
  const bHips = bodyFirst.createNode("Hips").setTranslation([0, 1, 0]);
  const bSpine = bodyFirst.createNode("Spine").setTranslation([0, 0.2, 0]);
  bHips.addChild(bSpine);
  bHips.addChild(bButton);
  bodyFirst.createSkin("body").addJoint(bHips).addJoint(bSpine);
  bodyFirst.createSkin("cloth").addJoint(bButton);
  bodyFirst.createScene().addChild(bHips);
  const bodySkel = humanoidSkeleton(bodyFirst, "acc");
  if (bodySkel === null) throw new Error("body-first document must map");
  TestValidator.equals(
    "skin order does not change the mapping",
    bodySkel.bones,
    accessorySkel.bones,
  );

  // 3. complementary partial skins union across the skin boundary
  const partial = new Document();
  const pHips = partial.createNode("Hips").setTranslation([0, 1, 0]);
  const pSpine = partial.createNode("Spine").setTranslation([0, 0.3, 0]);
  pHips.addChild(pSpine);
  partial.createSkin("lower").addJoint(pHips);
  partial.createSkin("upper").addJoint(pHips).addJoint(pSpine);
  partial.createScene().addChild(pHips);
  const partialSkel = humanoidSkeleton(partial, "partial");
  if (partialSkel === null) throw new Error("partial skins must union");
  TestValidator.equals(
    "complementary skins union hips and spine",
    bonesOf(partialSkel.bones),
    ["hips", "spine"],
  );
  TestValidator.equals(
    "spine parents hips across the skin boundary",
    partialSkel.bones.find((b) => b.bone === "spine")!.parent,
    "hips",
  );

  // 4. first-wins across skins for a slot two skins both name
  const dup = new Document();
  const dHips = dup.createNode("Hips").setTranslation([0, 1, 0]);
  const spineOne = dup.createNode("Spine").setTranslation([0, 0.25, 0]);
  const spineTwo = dup.createNode("Spine").setTranslation([0, 0.5, 0]);
  dHips.addChild(spineOne);
  dHips.addChild(spineTwo);
  dup.createSkin("first").addJoint(dHips).addJoint(spineOne);
  dup.createSkin("second").addJoint(spineTwo);
  dup.createScene().addChild(dHips);
  const dupSkel = humanoidSkeleton(dup, "dup");
  if (dupSkel === null) throw new Error("duplicate-slot document must map");
  const dupSpine = dupSkel.bones.find((b) => b.bone === "spine")!;
  TestValidator.equals(
    "the earlier skin's node owns a slot both skins name",
    dupSpine.rest.translation.y,
    0.25,
  );
};
