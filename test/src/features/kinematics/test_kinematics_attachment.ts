import { Quaternion, resolveAttachment, resolvePose } from "@automovie/engine";
import {
  IAutoMovieAttachment,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * `resolveAttachment` — the cross-skeleton joint that fixes a child model's
 * root into a bone of a posed parent (a rider in a horse's saddle). It runs FK
 * on the parent, reads the attachment bone's world position + orientation, and
 * composes the offset into that frame.
 *
 * The fixture skeleton stacks hips(0,1,0) → spine(0,0.2,0) → chest(0,0.2,0), so
 * at rest `chest` sits at world (0,1.4,0) with identity orientation.
 *
 * Scenarios:
 *
 * 1. Rest parent, identity offset → child root lands exactly on the chest's world
 *    position, identity rotation, offset scale passed through.
 * 2. A non-identity offset translation is placed in the bone's frame and added to
 *    the bone world position.
 * 3. Rotating the parent's root yaws the whole rig: the child inherits the bone's
 *    world rotation, and its offset translation is carried (rotated) into that
 *    frame — exactly matching a hand-composed FK result.
 * 4. Attaching to a bone absent from the skeleton throws.
 */
export const test_kinematics_attachment = (): void => {
  const skeleton = createSkeleton();
  const restPose = makePose([]);

  // 1. rest + identity offset → sits on the chest, scale carried
  const idOffset: IAutoMovieTransform = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 2, y: 2, z: 2 },
  };
  const att1: IAutoMovieAttachment = { parentBone: "chest", offset: idOffset };
  const r1 = resolveAttachment(restPose, skeleton, att1);
  TestValidator.predicate(
    "child sits on chest world pos (0,1.4,0)",
    nclose(r1.translation.x, 0) &&
      nclose(r1.translation.y, 1.4) &&
      nclose(r1.translation.z, 0),
  );
  TestValidator.predicate(
    "identity rotation at rest",
    nclose(r1.rotation.w, 1),
  );
  TestValidator.predicate("offset scale passed through", nclose(r1.scale.x, 2));

  // 2. offset translation added in the (rest = world) frame
  const att2: IAutoMovieAttachment = {
    parentBone: "chest",
    offset: {
      translation: { x: 0, y: 0.05, z: 0.1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
  };
  const r2 = resolveAttachment(restPose, skeleton, att2);
  TestValidator.predicate(
    "seat offset added to chest pos",
    nclose(r2.translation.y, 1.45) && nclose(r2.translation.z, 0.1),
  );

  // 3. yaw the whole rig via the pose root — child inherits the bone's world
  //    rotation and the offset is carried into that frame
  const yaw = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const yawed = makePose([], {
    translation: { x: 0, y: 0, z: 0 },
    rotation: yaw,
    scale: { x: 1, y: 1, z: 1 },
  });
  const r3 = resolveAttachment(yawed, skeleton, att2);

  // hand-compose against resolvePose to confirm the composition is exact
  const chest = resolvePose(yawed, skeleton).find((r) => r.bone === "chest")!;
  const expectedT = Quaternion.rotateVector(chest.worldRotation, {
    x: 0,
    y: 0.05,
    z: 0.1,
  });
  TestValidator.predicate(
    "child inherits chest world rotation (90° yaw, w≈cos45)",
    nclose(r3.rotation.w, Math.cos((45 * Math.PI) / 180)),
  );
  TestValidator.predicate(
    "offset translation carried into the rotated frame",
    nclose(r3.translation.x, chest.worldPosition.x + expectedT.x) &&
      nclose(r3.translation.y, chest.worldPosition.y + expectedT.y) &&
      nclose(r3.translation.z, chest.worldPosition.z + expectedT.z),
  );

  // 4. unknown bone → throws (the fixture skeleton has no rightFoot)
  TestValidator.error("attaching to a missing bone throws", () =>
    resolveAttachment(
      restPose,
      skeleton,
      { parentBone: "rightFoot", offset: idOffset },
      undefined,
    ),
  );

  // a referenced bone the fixture DOES have, with a non-rest articulation, also
  // resolves (exercises the jointAxes-less articulation path through FK)
  const posed = makePose([joint("spine", { flexion: 20 })]);
  const r5 = resolveAttachment(posed, skeleton, att1);
  TestValidator.predicate(
    "posed parent still resolves",
    Number.isFinite(r5.translation.y),
  );
};
