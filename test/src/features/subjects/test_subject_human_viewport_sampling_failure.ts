import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  createHumanViewportAsset,
  createHumanViewportFixture,
} from "../internal/createHumanViewportFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Sampler preparation owns a decoded asset even when device admission fails.
 * Its resources are released without displacing the last published preview.
 *
 * Scenarios:
 * 1. A nonfinite capability rejects the incoming face and releases its resources.
 * 2. The prior published model and its live resources remain untouched.
 */
export const test_subject_human_viewport_sampling_failure =
  async (): Promise<void> => {
    const f = createHumanViewportFixture({ maxAnisotropy: NaN });
    const current = createHumanViewportAsset();
    f.viewport.publish(current.model);
    const incoming = createHumanViewportAsset();
    const texture = new THREE.Texture();
    let disposed = 0;
    texture.addEventListener("dispose", () => disposed++);
    incoming.mesh.material.map = texture;
    f.state.group = incoming.model.group;
    const pending = f.viewport.build(humanFaceFixture());
    f.workers[0].onReply({ success: true, ...incoming.model });
    await TestValidator.error("invalid sampling capability", () => pending);
    TestValidator.equals("decoded resources released", incoming.released, {
      geometry: 1,
      material: 1,
    });
    TestValidator.equals("decoded texture released", disposed, 1);
    TestValidator.equals("current resources retained", current.released, {
      geometry: 0,
      material: 0,
    });
    f.viewport.finish();
    TestValidator.predicate(
      "current preview remains published",
      current.model.group.parent === f.frames[0].scene,
    );
    TestValidator.equals(
      "failed preview stays detached",
      incoming.model.group.parent,
      null,
    );
    TestValidator.equals("worker released", f.workers[0].terminations, 1);
    f.viewport.dispose(current.model);
  };
