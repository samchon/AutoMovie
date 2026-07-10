import { IAutoMovieSkeleton } from "@automovie/interface";
import {
  applyPose,
  buildScene,
  createImportedModelObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const TWO_BONES: IAutoMovieSkeleton = {
  id: "partial",
  bones: [
    { bone: "hips", parent: null, rest: IDENTITY_TRANSFORM, constraint: null },
    {
      bone: "head",
      parent: "hips",
      rest: IDENTITY_TRANSFORM,
      constraint: null,
    },
  ],
};

/**
 * Two viewer paths used to drop caller data in silence (#1051):
 *
 * 1. `buildScene` skipped a node whose model id could not resolve — and the
 *    segmentation mask palette is keyed by top-level child INDEX, so every
 *    later node shifted one color over and a mask consumer attributed pixels to
 *    the wrong node. Unresolvable caller data now throws, the same class as
 *    `buildModel`'s missing skin bone.
 * 2. `applyPose` dropped articulation for any bone missing from the model's bone
 *    map with no trace — a typo in an imported bone map was indistinguishable
 *    from a deliberately partial one. It now returns the skipped bones so the
 *    host can compare against what it meant to map.
 *
 * Scenarios: an unresolvable scene node throws naming the node and the model; a
 * two-bone skeleton applied to a model mapping only `hips` reports `head` as
 * skipped (and nothing when the map is complete).
 */
export const test_viewer_silent_skip_guards = (): void => {
  // 1. unresolvable scene node throws instead of shifting the mask palette
  TestValidator.predicate(
    "an unresolvable scene node throws with its ids",
    throwsError(
      () =>
        buildScene(
          {
            id: "scene-1",
            name: null,
            nodes: [
              {
                id: "node-ghost",
                model: "model-ghost",
                transform: IDENTITY_TRANSFORM,
                motion: null,
                pose: null,
              },
            ],
            cameras: [],
            lights: [],
          },
          () => undefined,
        ),
      ['scene node "node-ghost"', 'model "model-ghost"', "could not resolve"],
    ),
  );

  // 2. applyPose reports the bones the model map does not carry
  const hipsOnly = new THREE.Object3D();
  const partial = createImportedModelObject({
    object: new THREE.Object3D(),
    bones: { hips: hipsOnly },
  });
  const pose = { skeleton: TWO_BONES.id, root: null, joints: [] };
  TestValidator.equals(
    "unmapped skeleton bones are reported, mapped ones are not",
    applyPose(partial, pose, TWO_BONES),
    ["head"],
  );
  const full = createImportedModelObject({
    object: new THREE.Object3D(),
    bones: { hips: new THREE.Object3D(), head: new THREE.Object3D() },
  });
  TestValidator.equals(
    "a complete bone map reports nothing skipped",
    applyPose(full, pose, TWO_BONES),
    [],
  );
};
