import {
  MOTION_ROOT_NODE_ID,
  Matrix4,
  motionToClip,
  resolveFrame,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import { IAutoMovieTrack } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { bakeTimes } from "../internal/clipParity";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

/**
 * `motionToClip`'s `nodePrefix` gives a multi-actor node graph per-actor
 * channel namespaces (S3): every lowered node id AND every clip channel ref —
 * bones and the synthetic root alike — carries the prefix, while the default
 * stays the bare single-actor naming S1 shipped (byte-compat).
 *
 * Scenarios:
 *
 * 1. Default (no prefix): node ids and channel refs are bare — the S1 contract
 *    unchanged (the byte-compat twin of the prefixed run).
 * 2. Prefixed: every node id, every bone channel, and the root TRS channels carry
 *    the prefix; no bare id survives.
 * 3. Parity holds under the prefix: the world of `"knightA/" + bone` over the
 *    prefixed bridge equals `resolvePose ∘ sampleMotion` on every bake time —
 *    prefixing renames the graph without moving it.
 */
export const test_motion_to_clip_prefix = (): void => {
  const skeleton = createSkeleton();
  const motion = makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerArm", { flexion: 0 })], {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
  );

  const channelNode = (track: IAutoMovieTrack): string =>
    track.channel.kind === "node" ? track.channel.node : "";

  const bare = motionToClip({ motion, skeleton });
  TestValidator.predicate(
    "default keeps the bare S1 naming",
    bare.nodes.some((node) => node.id === MOTION_ROOT_NODE_ID) &&
      bare.nodes.some((node) => node.id === "leftLowerArm") &&
      bare.clip.tracks.every((track) => !channelNode(track).includes("/")),
  );

  const prefixed = motionToClip({ motion, skeleton, nodePrefix: "knightA/" });
  TestValidator.predicate(
    "every node id carries the prefix",
    prefixed.nodes.every((node) => node.id.startsWith("knightA/")),
  );
  TestValidator.predicate(
    "every channel ref carries the prefix (root TRS included)",
    prefixed.clip.tracks.every((track) =>
      channelNode(track).startsWith("knightA/"),
    ) &&
      prefixed.clip.tracks.some(
        (track) => channelNode(track) === `knightA/${MOTION_ROOT_NODE_ID}`,
      ),
  );

  let parity = true;
  for (const time of bakeTimes(motion.duration)) {
    const world = resolveFrame({
      nodes: prefixed.nodes,
      clip: prefixed.clip,
      limits: [],
      seconds: time,
    }).world;
    for (const bone of resolvePose(sampleMotion(motion, time).pose, skeleton)) {
      const matrix = world.get(`knightA/${bone.bone}`);
      if (
        matrix === undefined ||
        !vclose(Matrix4.position(matrix), bone.worldPosition) ||
        !qclose(Matrix4.decompose(matrix).rotation, bone.worldRotation)
      ) {
        parity = false;
        break;
      }
    }
    if (!parity) break;
  }
  TestValidator.predicate("parity holds under the prefix", parity);
};
