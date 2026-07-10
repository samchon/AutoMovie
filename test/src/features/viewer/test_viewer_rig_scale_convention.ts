import { IAutoMovieSkeleton } from "@automovie/interface";
import {
  applyPose,
  buildModel,
  createImportedModelObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";

const ROOT_ONLY: IAutoMovieSkeleton = {
  id: "root-only",
  bones: [
    { bone: "hips", parent: null, rest: IDENTITY_TRANSFORM, constraint: null },
  ],
};

/**
 * The rig scale convention (#1052, decision 309): the engine's FK composes
 * rotation and translation ONLY — `resolvePose` ignores bone-rest and pose-root
 * scale, and `motionToClip` pins the same ("rest scale ignored on both sides")
 * — so the render must ignore them too. The viewer used to apply both, making
 * every descendant diverge from what ground contact, collision, and framing
 * validated. Scene-node transforms and object-motion scale channels stay
 * first-class (#1049); this convention is about RIG bones and pose roots only.
 *
 * Scenarios:
 *
 * 1. A pose root with scale 2 moves the model root but leaves its scale at 1.
 * 2. A bone rest with scale 2 places the bone but leaves its scale at 1.
 */
export const test_viewer_rig_scale_convention = (): void => {
  // 1. pose-root scale is dropped, its translation applies
  const model = createImportedModelObject({ object: new THREE.Group() });
  applyPose(
    model,
    {
      skeleton: ROOT_ONLY.id,
      root: {
        translation: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 2, y: 2, z: 2 },
      },
      joints: [],
    },
    ROOT_ONLY,
  );
  TestValidator.predicate(
    "a pose-root scale is dropped while its translation applies",
    model.object.position.x === 1 && model.object.scale.x === 1,
  );

  // 2. bone-rest scale is dropped, its translation applies
  const built = buildModel({
    ...createModel(),
    id: "scaled-rest",
    skeleton: {
      id: "scaled-rest-skeleton",
      bones: [
        {
          bone: "hips",
          parent: null,
          rest: {
            translation: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 2, y: 2, z: 2 },
          },
          constraint: null,
        },
      ],
    },
  });
  const hips = built.bones.get("hips")!;
  TestValidator.predicate(
    "a bone-rest scale is dropped while its translation applies",
    hips.position.y === 1 && hips.scale.x === 1,
  );
};
