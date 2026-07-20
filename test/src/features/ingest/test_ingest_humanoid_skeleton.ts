import { resolvePose } from "@automovie/engine";
import { humanoidSkeleton } from "@automovie/ingest";
import { IAutoMovieBone } from "@automovie/interface";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

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
 * 6. A TRANSLATED helper's offset composes into the child's emitted rest (#1042):
 *    `Hips(0,1,0) → Helper(+0.1y) → Spine(+0.05y)` emits spine rest y = 0.15
 *    (relative to hips, per the `IAutoMovieBone.rest` contract), and FK through
 *    `resolvePose` places the spine at world y = 1.15.
 * 7. A ROTATED helper (90° about z) rotates the child's offset and rolls its rest
 *    rotation: spine local (0,0.2,0) emits rest t ≈ (−0.2,0,0) with the
 *    helper's quaternion, and FK lands at world (−0.2,1,0).
 * 8. A root bone does NOT compose its unmapped ancestors (an armature's transform
 *    belongs to the imported object, not the skeleton): hips under a translated
 *    `Armature` keeps its own local rest.
 * 9. UE-mannequin naming maps in-chain: `pelvis → spine_01 → spine_02 → spine_03`
 *    land on hips/spine/chest/upperChest (#1042's amplifier: an unmapped spine
 *    chain made dropped helper offsets the common case).
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

  // 6. a translated helper's offset survives into the emitted rest
  const restPose = (id: string) => ({ skeleton: id, root: null, joints: [] });
  const worldOf = (
    skeleton: { id: string; bones: IAutoMovieBone[] },
    bone: string,
  ) =>
    resolvePose(restPose(skeleton.id), skeleton).find((r) => r.bone === bone)!;

  const shifted = new Document();
  const sHips = shifted.createNode("Hips").setTranslation([0, 1, 0]);
  const sHelper = shifted.createNode("Helper").setTranslation([0, 0.1, 0]);
  const sSpine = shifted.createNode("Spine").setTranslation([0, 0.05, 0]);
  sHips.addChild(sHelper);
  sHelper.addChild(sSpine);
  shifted.createSkin("skin").addJoint(sHips).addJoint(sHelper).addJoint(sSpine);
  shifted.createScene().addChild(sHips);
  const shiftedSkel = humanoidSkeleton(shifted, "shifted")!;
  TestValidator.predicate(
    "a translated helper's offset composes into the child's rest",
    nclose(find(shiftedSkel.bones, "spine").rest.translation.y, 0.15),
  );
  TestValidator.predicate(
    "FK places the spine beyond the helper offset",
    vclose(worldOf(shiftedSkel, "spine").worldPosition, {
      x: 0,
      y: 1.15,
      z: 0,
    }),
  );

  // 7. a rotated helper rolls the child's offset and rest rotation
  const sq = Math.SQRT1_2;
  const rolled = new Document();
  const rHips = rolled.createNode("Hips").setTranslation([0, 1, 0]);
  const rHelper = rolled.createNode("Roll").setRotation([0, 0, sq, sq]);
  const rSpine = rolled.createNode("Spine").setTranslation([0, 0.2, 0]);
  rHips.addChild(rHelper);
  rHelper.addChild(rSpine);
  rolled.createSkin("skin").addJoint(rHips).addJoint(rHelper).addJoint(rSpine);
  rolled.createScene().addChild(rHips);
  const rolledSkel = humanoidSkeleton(rolled, "rolled")!;
  const rolledSpine = find(rolledSkel.bones, "spine");
  TestValidator.predicate(
    "a rotated helper rotates the child's rest offset and rolls its rotation",
    vclose(rolledSpine.rest.translation, { x: -0.2, y: 0, z: 0 }) &&
      nclose(rolledSpine.rest.rotation.z, sq) &&
      nclose(rolledSpine.rest.rotation.w, sq),
  );
  TestValidator.predicate(
    "FK lands the rolled spine beside the hips",
    vclose(worldOf(rolledSkel, "spine").worldPosition, { x: -0.2, y: 1, z: 0 }),
  );

  // 8. a root bone keeps its own local rest: the armature is not composed
  const wrapped = new Document();
  const armature = wrapped.createNode("Armature").setTranslation([5, 0, 0]);
  const wHips = wrapped.createNode("Hips").setTranslation([0, 1, 0]);
  const wSpine = wrapped.createNode("Spine").setTranslation([0, 0.3, 0]);
  armature.addChild(wHips);
  wHips.addChild(wSpine);
  wrapped.createSkin("skin").addJoint(wHips).addJoint(wSpine);
  wrapped.createScene().addChild(armature);
  const wrappedSkel = humanoidSkeleton(wrapped, "wrapped")!;
  TestValidator.predicate(
    "a root bone keeps its local rest without the armature transform",
    vclose(find(wrappedSkel.bones, "hips").rest.translation, {
      x: 0,
      y: 1,
      z: 0,
    }),
  );

  // 9. UE-mannequin spine chain maps in-chain
  const ue = new Document();
  const pelvis = ue.createNode("pelvis");
  const s01 = ue.createNode("spine_01");
  const s02 = ue.createNode("spine_02");
  const s03 = ue.createNode("spine_03");
  pelvis.addChild(s01);
  s01.addChild(s02);
  s02.addChild(s03);
  ue.createSkin("skin")
    .addJoint(pelvis)
    .addJoint(s01)
    .addJoint(s02)
    .addJoint(s03);
  ue.createScene().addChild(pelvis);
  const ueSkel = humanoidSkeleton(ue, "ue")!;
  TestValidator.equals(
    "UE-mannequin spine chain maps hips/spine/chest/upperChest in-chain",
    ["hips", "spine", "chest", "upperChest"].map(
      (b) => find(ueSkel.bones, b).parent,
    ),
    [null, "hips", "spine", "chest"],
  );
};
