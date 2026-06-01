import {
  IMoticaModel,
  IMoticaTransform,
  MoticaHumanoidBone,
} from "@motica/interface";
import * as THREE from "three";

import { buildGeometry, buildMaterial, defaultMaterial } from "./geometry";

/** A built model: its `three.js` root object and a lookup of its bones. */
export interface IMoticaModelObject {
  /** Root group — add this to a scene (or a node group) to display the model. */
  object: THREE.Group;
  /** Bones by humanoid slot, for posing. Empty for a non-rigged object. */
  bones: Map<MoticaHumanoidBone, THREE.Bone>;
}

/** Apply a motica TRS transform onto a `three.js` object. */
export const applyTransform = (
  obj: THREE.Object3D,
  t: IMoticaTransform,
): void => {
  obj.position.set(t.translation.x, t.translation.y, t.translation.z);
  obj.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
  obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
};

/**
 * Build a renderable `three.js` object from an {@link IMoticaModel}.
 *
 * Constructs the bone hierarchy (each `THREE.Bone` seeded with its rest
 * transform), then attaches each part: a _rigid_ part is parented to its
 * `attachedBone` (it rides that bone), everything else sits at the model root.
 * Skinned-mesh deformation is a future refinement — for now skinned/static
 * parts render at the root.
 *
 * The returned `bones` map is what {@link "./applyPose".applyPose} drives.
 *
 * @author Samchon
 */
export const buildModel = (model: IMoticaModel): IMoticaModelObject => {
  const group = new THREE.Group();
  group.name = model.name ?? model.id;

  const bones = new Map<MoticaHumanoidBone, THREE.Bone>();
  if (model.skeleton !== null) {
    for (const b of model.skeleton.bones) {
      const bone = new THREE.Bone();
      bone.name = b.bone;
      applyTransform(bone, b.rest);
      bones.set(b.bone, bone);
    }
    for (const b of model.skeleton.bones) {
      const bone = bones.get(b.bone)!;
      const parent = b.parent !== null ? bones.get(b.parent) : undefined;
      (parent ?? group).add(bone);
    }
  }

  const materials = new Map(
    model.materials.map((m) => [m.id, buildMaterial(m)] as const),
  );
  for (const part of model.parts) {
    const geo = buildGeometry(part.geometry);
    const mat =
      part.material !== null
        ? (materials.get(part.material) ?? defaultMaterial())
        : defaultMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = part.name ?? part.id;
    if (part.transform !== null) applyTransform(mesh, part.transform);
    const parentBone =
      part.attachedBone !== null ? bones.get(part.attachedBone) : undefined;
    (parentBone ?? group).add(mesh);
  }

  return { object: group, bones };
};
