import { sampleMotion, validateMotion } from "@automovie/engine";
import type {
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";

import { buildWaveClip } from "./motion";

/**
 * The DIRECT-LINK path: import `@automovie/interface` (types) and
 * `@automovie/engine` (the deterministic engine), author a clip in code, and
 * drive the same primitives the MCP server exposes — here `validateMotion`
 * (engine enforces) and `sampleMotion` (engine plays). The MCP path in
 * `automovie.config.jsonc` is the other door; both create motion, one engine
 * enforces it.
 */

const rest = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A minimal arm chain — enough for the engine to run FK and ROM-check a pose. */
const skeleton: IAutoMovieSkeleton = {
  id: "starter-rig",
  bones: [
    { bone: "hips", parent: null, rest: rest(0, 1, 0), constraint: null },
    { bone: "chest", parent: "hips", rest: rest(0, 0.4, 0), constraint: null },
    {
      bone: "leftUpperArm",
      parent: "chest",
      rest: rest(0.2, 0, 0),
      constraint: null,
    },
    {
      bone: "leftLowerArm",
      parent: "leftUpperArm",
      rest: rest(0.3, 0, 0),
      constraint: null,
    },
  ],
};

// You create: a clip computed in code (see motion.ts).
const clip = buildWaveClip(skeleton.id);

// The engine enforces: ROM + temporal coherence. Try buildWaveClip(id, 400)
// and watch the engine refuse it (a range / temporal-coherence violation).
const validation = validateMotion({ motion: clip, skeleton });
if (validation.success === false) {
  console.error(`clip "${clip.id}" is not physically valid:`);
  for (const violation of validation.violations)
    console.error(`  ${violation.path}: ${violation.expected}`);
  process.exit(1);
}
console.log(`clip "${clip.id}" is valid (${clip.keyframes.length} keyframes).`);

// The engine plays: sample a pose at mid-swing.
const middle = sampleMotion(clip, 0.5);
const arm = middle.pose.joints.find((joint) => joint.bone === "leftUpperArm");
console.log(
  `at t=0.5s the left upper arm flexes ${arm?.flexion?.toFixed(1) ?? "0"}°.`,
);
