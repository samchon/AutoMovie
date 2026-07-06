import { AutoMovieHumanoidBone } from "@automovie/interface";
import {
  IAutoMovieModelObject,
  createImportedModelObject,
} from "@automovie/viewer";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as THREE from "three";

const VRM_AUTOMOVIE_BONES = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal",
] as const satisfies readonly AutoMovieHumanoidBone[];

/**
 * Adapt a loaded `@pixiv/three-vrm` avatar to the generic viewer runtime.
 *
 * The playground owns loading and VRM-specific setup; the viewer only receives
 * normalized bone nodes and an expression sink, keeping `@automovie/viewer`
 * free of VRM dependencies.
 *
 * @author Samchon
 */
export const createVrmModelObject = (vrm: VRM): IAutoMovieModelObject => {
  const bones: Partial<Record<AutoMovieHumanoidBone, THREE.Object3D>> = {};
  for (const bone of VRM_AUTOMOVIE_BONES) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone as VRMHumanBoneName);
    if (node !== null) bones[bone] = node;
  }
  return createImportedModelObject({
    object: vrm.scene,
    bones,
    expressionTargets: [
      {
        setExpressionValue: (name, weight) =>
          vrm.expressionManager?.setValue(name, weight),
      },
    ],
    afterAutoMovieFrame: ({ deltaSeconds }) =>
      vrm.update(deltaSeconds > 0 ? deltaSeconds : 1 / 60),
  });
};
