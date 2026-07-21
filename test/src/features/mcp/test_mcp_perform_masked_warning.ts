import { IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

/**
 * A gait that swings the arms, the way every shipped `HUMANOID_GAITS` kind
 * does.
 */
const ARM_SWINGING_WALK = {
  name: "walk",
  period: 1,
  // Only bones the shared fixture rig carries, so this scenario measures the
  // region mask rather than a rig gap: the swing rows are what matter.
  limbs: [
    { bone: "leftUpperLeg" as const, phase: 0, duty: 0.5, amplitude: 25 },
    { bone: "leftUpperArm" as const, phase: 0.5, duty: 0.5, amplitude: 18 },
    { bone: "rightUpperArm" as const, phase: 0, duty: 0.5, amplitude: 18 },
  ],
};

const context = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const rig = createSkeleton();
  return {
    skeleton: rig.id,
    gaits: [ARM_SWINGING_WALK],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig,
  };
};

/**
 * A masked-content warning reaches the agent, at a path the agent wrote
 * (#1359).
 *
 * The engine reports what a region mask dropped on the SUCCESS arm, as advice
 * rather than a refusal, because the mask is the mechanism that lets a walk and
 * a wave layer and every stock gait counter-swings the arms. That report is
 * worth nothing if the MCP tool eats it, or if it arrives naming
 * `$input.draft[0].region` when the caller wrote `$input.performance.draft[0]`:
 * the path dialect the failure arm was re-anchored to in #1294 binds the
 * success arm's notes too.
 *
 * Scenarios:
 *
 * 1. A plain `locomote` on an arm-swinging gait performs through the MCP tool, and
 *    its result carries a `warning`-severity note naming both arm bones.
 * 2. That note is anchored at `$input.performance.draft[0].region`, the field in
 *    the payload the caller sent, not at the engine's own `$input.draft[0]`.
 * 3. Negative twin: the same call with `region: "fullBody"` performs and carries
 *    no warnings field at all, so the note tracks the mask rather than the
 *    verb.
 */
export const test_mcp_perform_masked_warning = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");
  const nodePosition = (id: string): IAutoMovieVector3 =>
    staged.scene.nodes.find((x) => x.id === id)!.transform.translation;

  const walk = (region?: "fullBody") =>
    app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [
          {
            verb: "locomote",
            actor: "knightA",
            start: 0,
            duration: 1,
            gait: "walk",
            to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
            ...(region === undefined ? {} : { region }),
          },
          {
            verb: "frame",
            actor: "cam-main",
            start: 0,
            duration: "auto",
            framing: "medium",
            move: "static",
            on: { kind: "node", node: "knightA" },
          },
        ],
        duration: 1,
        revise: { review: "the walk reads.", final: null },
      }),
      actors: {
        knightA: context(nodePosition("knightA"), 0),
        knightB: context(nodePosition("knightB"), 180),
      },
    }).performed;

  // 1. the plain walk performs and says what the region dropped
  const plain = walk();
  TestValidator.equals("the plain walk performs", plain.success, true);
  TestValidator.predicate(
    "its result carries a warning naming both swung arms",
    plain.success === true &&
      (plain.warnings ?? []).some(
        (v) =>
          v.severity === "warning" &&
          v.expected.includes("leftUpperArm") &&
          v.expected.includes("rightUpperArm"),
      ),
  );

  // 2. anchored where the caller wrote the field
  TestValidator.equals(
    "the warning is anchored in the caller's own payload path",
    plain.success === true ? (plain.warnings ?? []).map((v) => v.path) : [],
    ["$input.performance.draft[0].region"],
  );

  // 3. NEGATIVE TWIN: a region that owns the arms warns about nothing
  const widened = walk("fullBody");
  TestValidator.equals("the widened walk performs", widened.success, true);
  TestValidator.equals(
    "and carries no warnings",
    widened.success === true ? (widened.warnings ?? []).length : -1,
    0,
  );
};
