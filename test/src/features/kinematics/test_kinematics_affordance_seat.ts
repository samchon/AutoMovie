import { Quaternion, Vector3, resolveAffordanceSeat } from "@automovie/engine";
import {
  IAutoMovieAffordance,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { qclose, vclose } from "../internal/predicates";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const UNIT = { x: 1, y: 1, z: 1 };

const affordance = (
  kind: IAutoMovieAffordance["kind"],
  frame: IAutoMovieTransform,
): IAutoMovieAffordance => ({ id: `${kind}-1`, kind, frame, extent: null });

const frameAt = (
  x: number,
  y: number,
  z: number,
  rotation = IDENTITY,
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale: UNIT,
});

/**
 * `resolveAffordanceSeat` places a child model so its contact frame coincides
 * with a parent affordance's world frame: the model-frame sibling of the bone
 * attachment. The oracle is hand math on a rotated parent; coincidence is then
 * asserted directly (`childWorld ∘ childFrame == parent contact frame`), which
 * must hold for any input by construction.
 *
 * Scenarios:
 *
 * 1. Child origin (no child affordance) on a stack-top of a parent translated to
 *    (2,1,3) and yawed 90°: the off-center face (0.5, 0.5, 0) rotates to (0,
 *    0.5, -0.5), so the seat is exactly (2, 1.5, 2.5) with the parent's yaw:
 *    hand oracle.
 * 2. A child socket at local (0, 0.1, 0) seats 0.1 m _below_ the contact (childPos
 *    = contact − childRot·socket): (2, 1.4, 3) under a centered top at (2, 1.5,
 *    3): hand oracle, and the frames coincide numerically.
 * 3. A rotated handle/hand pair (parent frame yawed, child frame pitched): the
 *    composed child world still lands its hand frame exactly on the handle
 *    frame: coincidence assertions on position and rotation.
 */
export const test_kinematics_affordance_seat = (): void => {
  const yaw90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const parentWorld: IAutoMovieTransform = {
    translation: { x: 2, y: 1, z: 3 },
    rotation: yaw90,
    scale: UNIT,
  };

  const offCenterTop = affordance("stack-top", frameAt(0.5, 0.5, 0));
  const originSeat = resolveAffordanceSeat({
    parentWorld,
    parentAffordance: offCenterTop,
  });
  TestValidator.predicate(
    "child-origin seat lands on the rotated contact",
    vclose(originSeat.translation, { x: 2, y: 1.5, z: 2.5 }),
  );
  TestValidator.predicate(
    "child-origin seat inherits the contact rotation",
    qclose(originSeat.rotation, yaw90),
  );
  TestValidator.predicate(
    "seating never rescales",
    vclose(originSeat.scale, UNIT),
  );

  const centeredTop = affordance("stack-top", frameAt(0, 0.5, 0));
  const socket = affordance("socket", frameAt(0, 0.1, 0));
  const socketSeat = resolveAffordanceSeat({
    parentWorld,
    parentAffordance: centeredTop,
    childAffordance: socket,
  });
  TestValidator.predicate(
    "socket seat sits one socket-offset below the contact",
    vclose(socketSeat.translation, { x: 2, y: 1.4, z: 3 }),
  );
  const socketWorld = Vector3.add(
    socketSeat.translation,
    Quaternion.rotateVector(socketSeat.rotation, socket.frame.translation),
  );
  TestValidator.predicate(
    "child socket frame coincides with the parent contact",
    vclose(socketWorld, { x: 2, y: 1.5, z: 3 }),
  );

  const handle = affordance(
    "handle",
    frameAt(0.3, 0.2, 0, Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, 90)),
  );
  const hand = affordance(
    "socket",
    frameAt(0.05, 0, 0, Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, 90)),
  );
  const identityParent: IAutoMovieTransform = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: IDENTITY,
    scale: UNIT,
  };
  const grip = resolveAffordanceSeat({
    parentWorld: identityParent,
    parentAffordance: handle,
    childAffordance: hand,
  });
  const handWorldRotation = Quaternion.multiply(
    grip.rotation,
    hand.frame.rotation,
  );
  TestValidator.predicate(
    "hand frame rotation aligns onto the handle frame",
    qclose(handWorldRotation, handle.frame.rotation),
  );
  const handWorldPosition = Vector3.add(
    grip.translation,
    Quaternion.rotateVector(grip.rotation, hand.frame.translation),
  );
  TestValidator.predicate(
    "hand frame position aligns onto the handle frame",
    vclose(handWorldPosition, handle.frame.translation),
  );
};
