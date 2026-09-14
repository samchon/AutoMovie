import { TestValidator } from "@nestia/e2e";

import {
  createHumanViewportAsset,
  createHumanViewportFixture,
} from "../internal/createHumanViewportFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Decoding uses only the returned GLB view, and publication releases exactly the
 * displaced preview while repeated publication of one object is inert.
 *
 * Scenarios:
 * 1. A worker result decodes its byte subrange and receives preview shadow policy.
 * 2. Initial and repeated publication retain one live group without disposal.
 * 3. Replacement removes and disposes the old group; detached disposal is separate.
 */
export const test_subject_human_viewport_publication =
  async (): Promise<void> => {
    const f = createHumanViewportFixture();
    const a = createHumanViewportAsset();
    f.state.group = a.model.group;
    const document = humanFaceFixture();
    const pending = f.viewport.build(document);
    TestValidator.equals(
      "worker receives admitted document",
      JSON.parse(f.workers[0].sent[0]),
      document,
    );
    f.workers[0].onReply({ success: true, ...a.model });
    const built = await pending;
    TestValidator.equals(
      "decoder sees only the GLB view",
      Array.from(new Uint8Array(f.decoded[0])),
      [7, 8],
    );
    TestValidator.predicate(
      "decoder buffer ownership",
      f.decoded[0] !== a.model.glb.buffer,
    );
    TestValidator.predicate(
      "opaque anatomy casts and receives shadows",
      a.mesh.castShadow && a.mesh.receiveShadow,
    );
    TestValidator.predicate(
      "loaded group retained",
      built.group === a.model.group,
    );
    TestValidator.equals("worker terminated", f.workers[0].terminations, 1);
    f.viewport.publish(built);
    f.viewport.finish();
    const scene = f.frames[0].scene;
    TestValidator.predicate(
      "published group visible",
      built.group.parent === scene,
    );
    f.viewport.publish(built);
    TestValidator.equals("repeat does not dispose", a.released, {
      geometry: 0,
      material: 0,
    });
    TestValidator.equals(
      "repeat does not duplicate",
      scene.children.filter((child) => child === built.group).length,
      1,
    );
    f.viewport.fitView();
    TestValidator.predicate(
      "current model fits camera",
      f.camera().position.z > 0.3,
    );
    const b = createHumanViewportAsset();
    f.viewport.publish(b.model);
    TestValidator.predicate(
      "replacement group visible and old group detached",
      b.model.group.parent === scene && built.group.parent === null,
    );
    TestValidator.equals("old geometry released exactly once", a.released, {
      geometry: 1,
      material: 1,
    });
    TestValidator.equals("new geometry remains live", b.released, {
      geometry: 0,
      material: 0,
    });
    const detached = createHumanViewportAsset();
    f.viewport.dispose(detached.model);
    TestValidator.equals(
      "unpublished asset can be released",
      detached.released,
      { geometry: 1, material: 1 },
    );
    f.viewport.dispose(b.model);
  };
