import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  createHumanViewportAsset,
  createHumanViewportFixture,
} from "../internal/createHumanViewportFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The actual decoded-preview consumer uses the renderer capability, not a
 * subject name or a changed export, before publishing the current face.
 *
 * Scenarios:
 * 1. Device limits of 0, 4 and 32 produce sampler values of 1, 4 and 16.
 * 2. Returned GLB bytes retain the worker's exact view through publication.
 */
export const test_subject_human_viewport_anisotropy =
  async (): Promise<void> => {
    for (const [maximum, expected] of [
      [0, 1],
      [4, 4],
      [32, 16],
    ]) {
      const f = createHumanViewportFixture({ maxAnisotropy: maximum });
      const a = createHumanViewportAsset();
      const texture = new THREE.Texture();
      a.mesh.material.map = texture;
      f.state.group = a.model.group;
      const pending = f.viewport.build(humanFaceFixture());
      f.workers[0].onReply({ success: true, ...a.model });
      const built = await pending;
      TestValidator.equals(
        "capability reaches decoded texture",
        texture.anisotropy,
        expected,
      );
      TestValidator.predicate(
        "worker GLB remains exact",
        built.glb === a.model.glb,
      );
      f.viewport.publish(built);
      TestValidator.equals(
        "publication retains sampler",
        texture.anisotropy,
        expected,
      );
      f.viewport.dispose(built);
    }
  };
