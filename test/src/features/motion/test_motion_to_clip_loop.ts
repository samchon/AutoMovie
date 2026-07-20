import { motionToClip } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { bakeTimes, clipWorldParity } from "../internal/clipParity";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

/**
 * Loop semantics carry through the bridge: `sampleMotion` and `sampleClip`
 * normalize time identically (wrap modulo duration when looping, clamp
 * otherwise), so the lowered clip stays in parity even when queried outside
 * `[0, duration]`.
 *
 * Scenarios:
 *
 * 1. The bridge copies the motion's loop flag, id, and duration onto the clip.
 * 2. A looping motion holds parity at wrapped queries: t = duration (wraps to 0
 *    on both sides), t = 1.3·duration, and a negative t.
 * 3. Non-loop twin: the same motion with loop off clamps past the end on both
 *    sides (parity at t = duration + 0.5).
 */
export const test_motion_to_clip_loop = (): void => {
  const skeleton = createSkeleton();
  const looping = swingMotion(true);

  const bridge = motionToClip({ motion: looping, skeleton });
  TestValidator.equals("loop carried", bridge.clip.loop, true);
  TestValidator.equals("id carried", bridge.clip.id, looping.id);
  TestValidator.equals("duration carried", bridge.clip.duration, 1);

  TestValidator.predicate(
    "parity under wrap",
    clipWorldParity({
      motion: looping,
      skeleton,
      times: [...bakeTimes(1), 1, 1.3, -0.2],
    }),
  );

  TestValidator.predicate(
    "non-loop twin clamps in parity",
    clipWorldParity({
      motion: swingMotion(false),
      skeleton,
      times: [1.5],
    }),
  );
};

/** A seamless two-key elbow swing (last keyframe continuous with the first). */
const swingMotion = (loop: boolean) =>
  makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(0.5, makePose([joint("leftLowerArm", { flexion: 90 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 0 })])),
    ],
    1,
    loop,
  );
