import { MOTION_ROOT_NODE_ID, motionToClip } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * The bridge is an explicit conversion, so structural misuse throws instead of
 * silently dropping animated data: a motion articulating a bone the skeleton
 * does not have would bake to nothing (`resolvePose` ignores it), which is
 * lossy — the bridge refuses.
 *
 * Scenarios:
 *
 * 1. A valid two-bone motion bakes: one rotation track per articulated bone in
 *    skeleton order, nodes = bones + the synthetic root, the bake clock ending
 *    exactly at the duration.
 * 2. Empty keyframes throw.
 * 3. Non-positive / non-finite sampleRate throws.
 * 4. Non-positive / non-finite duration throws.
 * 5. A motion articulating a bone missing from the skeleton throws, naming the
 *    bone.
 */
export const test_motion_to_clip_guards = (): void => {
  const skeleton = createSkeleton();
  const valid = makeMotion(
    [
      keyframe(
        0,
        makePose([
          joint("leftLowerArm", { flexion: 0 }),
          joint("leftUpperArm", { flexion: 10 }),
        ]),
      ),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
  );

  const bridge = motionToClip({ motion: valid, skeleton });
  TestValidator.equals(
    "one rotation track per articulated bone, skeleton order",
    bridge.clip.tracks.map((t) =>
      t.channel.kind === "node" ? t.channel.node : "",
    ),
    ["leftUpperArm", "leftLowerArm"],
  );
  TestValidator.equals(
    "nodes are bones plus the synthetic root",
    bridge.nodes.length,
    skeleton.bones.length + 1,
  );
  TestValidator.equals(
    "root node leads the lowered hierarchy",
    bridge.nodes[0]!.id,
    MOTION_ROOT_NODE_ID,
  );
  const track = bridge.clip.tracks[0]!;
  TestValidator.equals(
    "bake clock ends exactly at duration",
    track.times[track.times.length - 1],
    1,
  );
  TestValidator.equals("clip name is null", bridge.clip.name, null);

  TestValidator.predicate(
    "empty keyframes throw",
    throwsError(
      () => motionToClip({ motion: { ...valid, keyframes: [] }, skeleton }),
      "must have keyframes",
    ),
  );
  TestValidator.predicate(
    "zero sampleRate throws",
    throwsError(
      () => motionToClip({ motion: valid, skeleton, sampleRate: 0 }),
      "sampleRate",
    ),
  );
  TestValidator.predicate(
    "NaN sampleRate throws",
    throwsError(
      () => motionToClip({ motion: valid, skeleton, sampleRate: Number.NaN }),
      "sampleRate",
    ),
  );
  TestValidator.predicate(
    "zero duration throws",
    throwsError(
      () => motionToClip({ motion: { ...valid, duration: 0 }, skeleton }),
      "duration",
    ),
  );
  TestValidator.predicate(
    "infinite duration throws",
    throwsError(
      () =>
        motionToClip({
          motion: { ...valid, duration: Number.POSITIVE_INFINITY },
          skeleton,
        }),
      "duration",
    ),
  );
  TestValidator.predicate(
    "unknown articulated bone throws, naming it",
    throwsError(
      () =>
        motionToClip({
          motion: makeMotion(
            [
              keyframe(0, makePose([joint("leftToes", { flexion: 5 })])),
              keyframe(1, makePose([joint("leftToes", { flexion: 15 })])),
            ],
            1,
          ),
          skeleton,
        }),
      ["leftToes", "does not have"],
    ),
  );
};
