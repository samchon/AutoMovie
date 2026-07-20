import { MOTION_ROOT_NODE_ID, motionToClip } from "@automovie/engine";
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
 * The root fold: `resolvePose` seats root bones under `pose.root`'s
 * rotation/translation, and the bridge mirrors that by lowering the sampled
 * root onto a synthetic root node's translation/rotation tracks. A keyframe
 * with `root: null` blends against the identity transform (the sampler's
 * mixed-null rule), which the dense bake captures.
 *
 * Scenarios:
 *
 * 1. A motion whose root is set on one keyframe and `null` on the other holds
 *    parity at every baked time: the null side folds as identity.
 * 2. Root tracks exist exactly when some keyframe has a root: the animated motion
 *    emits translation + rotation tracks on the synthetic root node.
 * 3. Negative twin: an all-null-root motion emits no root-node tracks at all.
 */
export const test_motion_to_clip_root = (): void => {
  const skeleton = createSkeleton();
  const rooted = makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftUpperArm", { flexion: 30 })], {
          translation: { x: 1, y: 2, z: 3 },
          rotation: {
            x: 0,
            y: Math.sin(Math.PI / 4),
            z: 0,
            w: Math.cos(Math.PI / 4),
          },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
      keyframe(1, makePose([joint("leftUpperArm", { flexion: 60 })], null)),
    ],
    1,
  );

  TestValidator.predicate(
    "mixed null/non-null root parity",
    clipWorldParity({
      motion: rooted,
      skeleton,
      times: bakeTimes(1),
    }),
  );

  const bridge = motionToClip({ motion: rooted, skeleton });
  const rootTracks = bridge.clip.tracks.filter(
    (track) =>
      track.channel.kind === "node" &&
      track.channel.node === MOTION_ROOT_NODE_ID,
  );
  TestValidator.equals(
    "root translation + rotation tracks emitted",
    rootTracks
      .map((t) => (t.channel.kind === "node" ? t.channel.path : ""))
      .sort((a, b) => a.localeCompare(b)),
    ["rotation", "translation"],
  );

  const unrooted = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperArm", { flexion: 30 })])),
      keyframe(1, makePose([joint("leftUpperArm", { flexion: 60 })])),
    ],
    1,
  );
  const bare = motionToClip({ motion: unrooted, skeleton });
  TestValidator.equals(
    "all-null root emits no root tracks",
    bare.clip.tracks.some(
      (track) =>
        track.channel.kind === "node" &&
        track.channel.node === MOTION_ROOT_NODE_ID,
    ),
    false,
  );
};
