import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  createHumanViewportAsset,
  createHumanViewportFixture,
} from "../internal/createHumanViewportFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Cancellation during decoding releases the obsolete group through the actual
 * viewport adapter, not merely through an abstract builder's disposal callback.
 *
 * Scenarios:
 * 1. A held decoder is cancelled and resolves later; its resources are released.
 * 2. The currently displayed group and its resources remain unchanged.
 */
export const test_subject_human_viewport_stale = async (): Promise<void> => {
  let complete!: (group: THREE.Group) => void;
  const decoding = new Promise<THREE.Group>((resolve) => {
    complete = resolve;
  });
  let begin!: (value: true) => void;
  const entered = new Promise<true>((resolve) => {
    begin = resolve;
  });
  const f = createHumanViewportFixture({
    decode: () => {
      begin(true);
      return decoding;
    },
  });
  const current = createHumanViewportAsset();
  f.viewport.publish(current.model);
  const obsolete = createHumanViewportAsset();
  const pending = f.viewport.build(humanFaceFixture());
  f.workers[0].onReply({ success: true, ...obsolete.model });
  await entered;
  f.viewport.cancel();
  complete(obsolete.model.group);
  await TestValidator.error("cancelled decode is refused", () => pending);
  TestValidator.equals("obsolete geometry released", obsolete.released, {
    geometry: 1,
    material: 1,
  });
  TestValidator.equals("current geometry retained", current.released, {
    geometry: 0,
    material: 0,
  });
  f.viewport.finish();
  TestValidator.predicate(
    "current group remains visible",
    current.model.group.parent === f.frames[0].scene &&
      obsolete.model.group.parent === null,
  );
  f.viewport.dispose(current.model);
};
