import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  Matrix4,
  motionToClip,
  resolveFrame,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { bakeTimes, clipWorldParity } from "../internal/clipParity";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/**
 * The clinical remaps ride the bridge: `jointAxes` and `restFrames` are passed
 * through to the bake exactly as `resolvePose` consumes them, so a pose
 * authored in the clinical convention (e.g. +abduction raises either arm via
 * the mirrored shoulder rest frames) lowers to the same world transforms.
 *
 * Scenarios:
 *
 * 1. A both-shoulders abduction motion baked with `HUMANOID_JOINT_AXES` +
 *    `HUMANOID_REST_FRAME` holds parity at every baked time.
 * 2. Negative twin: the remap is not a no-op; the left hand's world position
 *    baked with the rest frames differs from the bake without them.
 */
export const test_motion_to_clip_frames = (): void => {
  const skeleton = createSkeleton();
  const motion = makeMotion(
    [
      keyframe(
        0,
        makePose([
          joint("leftUpperArm", { abduction: 90 }),
          joint("rightUpperArm", { abduction: 90 }),
        ]),
      ),
      keyframe(
        1,
        makePose([
          joint("leftUpperArm", { abduction: 130 }),
          joint("rightUpperArm", { abduction: 130 }),
        ]),
      ),
    ],
    1,
  );

  TestValidator.predicate(
    "rest-frame parity",
    clipWorldParity({
      motion,
      skeleton,
      times: bakeTimes(1),
      jointAxes: HUMANOID_JOINT_AXES,
      restFrames: HUMANOID_REST_FRAME,
    }),
  );

  const framed = motionToClip({
    motion,
    skeleton,
    jointAxes: HUMANOID_JOINT_AXES,
    restFrames: HUMANOID_REST_FRAME,
  });
  const plain = motionToClip({ motion, skeleton });
  const handAt = (bridge: typeof framed) =>
    Matrix4.position(
      resolveFrame({
        nodes: bridge.nodes,
        clip: bridge.clip,
        limits: [],
        seconds: 0.5,
      }).world.get("leftHand")!,
    );
  TestValidator.predicate(
    "remap is not a no-op",
    !vclose(handAt(framed), handAt(plain), 1e-3),
  );
};
