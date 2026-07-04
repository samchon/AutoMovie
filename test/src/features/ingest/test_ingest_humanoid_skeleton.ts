import { humanoidSkeleton } from "@automovie/ingest";
import { IAutoMovieBone } from "@automovie/interface";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const find = (bones: IAutoMovieBone[], bone: string): IAutoMovieBone => {
  const b = bones.find((x) => x.bone === bone);
  if (b === undefined) throw new Error(`bone ${bone} missing`);
  return b;
};

/**
 * Retarget an imported skin's joints onto the humanoid slots by name,
 * rebuilding the hierarchy over the mapped bones only.
 *
 * The synthetic rig (Mixamo-style names): `Hips → HelperBone → Spine →
 * LeftArm`, plus a duplicate `Spine` and an unmapped `RandomThing`, all in the
 * skin.
 *
 * Scenarios:
 *
 * 1. A document with no skin yields `null`.
 * 2. A skin without a hips joint yields `null` (no humanoid root).
 * 3. The full rig maps `Hips→hips`, `Spine→spine`, `LeftArm→leftUpperArm`; the
 *    `mixamorig:` prefix and separators are normalized away.
 * 4. The unmapped `HelperBone` is skipped, but `Spine`'s parent resolves to `hips`
 *    through it (nearest mapped ancestor), and `LeftArm`'s parent is `spine`;
 *    hips itself is parentless.
 * 5. The duplicate `Spine` and the unmapped `RandomThing` joints are dropped, so
 *    only three bones remain, and the hips rest translation is carried
 *    through.
 */
export const test_ingest_humanoid_skeleton = (): void => {
  // 1. no skin
  const noSkin = new Document();
  noSkin.createScene().addChild(noSkin.createNode("mixamorig:Hips"));
  TestValidator.equals("no skin → null", humanoidSkeleton(noSkin), null);

  // 2. skin without hips
  const noHips = new Document();
  const spineOnly = noHips.createNode("mixamorig:Spine");
  noHips.createSkin("s").addJoint(spineOnly);
  noHips.createScene().addChild(spineOnly);
  TestValidator.equals("no hips → null", humanoidSkeleton(noHips), null);

  // 3-5. full rig
  const doc = new Document();
  const hips = doc.createNode("mixamorig:Hips").setTranslation([0, 1, 0]);
  const helper = doc.createNode("HelperBone");
  const spine = doc.createNode("mixamorig:Spine");
  const arm = doc.createNode("mixamorig:LeftArm");
  const dup = doc.createNode("mixamorig:Spine");
  const junk = doc.createNode("RandomThing");
  hips.addChild(helper);
  helper.addChild(spine);
  spine.addChild(arm);
  hips.addChild(dup);
  hips.addChild(junk);
  doc
    .createSkin("skin")
    .addJoint(hips)
    .addJoint(helper)
    .addJoint(spine)
    .addJoint(arm)
    .addJoint(dup)
    .addJoint(junk);
  doc.createScene().addChild(hips);

  const skel = humanoidSkeleton(doc, "human");
  if (skel === null) throw new Error("expected a skeleton");

  TestValidator.equals("skeleton id", skel.id, "human");
  TestValidator.equals("three mapped bones", skel.bones.length, 3);
  TestValidator.equals("hips is root", find(skel.bones, "hips").parent, null);
  TestValidator.equals(
    "spine parents hips through the helper",
    find(skel.bones, "spine").parent,
    "hips",
  );
  TestValidator.equals(
    "left arm parents spine",
    find(skel.bones, "leftUpperArm").parent,
    "spine",
  );
  TestValidator.predicate(
    "hips rest translation carried",
    nclose(find(skel.bones, "hips").rest.translation.y, 1),
  );
};
