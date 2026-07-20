import {
  IAutoMovieBlockingApplication,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

type ICoverage = IAutoMovieBlockingApplication.ICoverageIntent;

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staged = app.stage({
  script,
  staging: makeStagingWrite({
    cameras: [
      {
        node: "cam-main",
        position: { x: 2, y: 1.5, z: 0.35 },
        lookAt: { kind: "node", node: "knightA" },
        fovDeg: 40,
      },
      {
        node: "cam-alt",
        position: { x: -2, y: 1.5, z: 0.35 },
        lookAt: { kind: "node", node: "knightB" },
        fovDeg: 40,
      },
    ],
  }),
}).staged;
if (staged.success !== true) throw new Error("stage fixture must succeed");

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
  };
};

const position = (id: string): IAutoMovieVector3 => {
  const node = staged.scene.nodes.find((entry) => entry.id === id);
  if (node === undefined) throw new Error(`missing node ${id}`);
  return node.transform.translation;
};

/** A well-formed coverage intent on the staged alternate camera. */
const coverage = (over: Partial<ICoverage> = {}): ICoverage => ({
  camera: "cam-alt",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
  ...over,
});

/** `block` with `coverage` forced to an arbitrary (possibly malformed) value. */
const block = (list: unknown) =>
  app.block({
    script,
    staged,
    blocking: {
      ...makeBlockingWrite(),
      coverage: list as ICoverage[],
    },
  }).blocked;

/** `perform` the duel beat under a blocking carrying `list`. */
const perform = (list: unknown) =>
  app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: ["knightA", "knightB"],
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
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
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: actorContext(position("knightA"), 0),
      knightB: actorContext(position("knightB"), 180),
    },
    blocking: {
      ...makeBlockingWrite(),
      coverage: list as ICoverage[],
    },
  }).performed;

/**
 * `coverage` (#1187) is an optional array both blocking consumers walk, so the
 * MCP tool boundary owes it the same structural floor the rest of the blocking
 * gets. `blockBeat` reads `intent.on.kind` and `performShot` compiles each
 * entry into an alternate take, so a non-array list or a targetless entry would
 * throw a `TypeError` out of the engine instead of refusing with a
 * field-located violation. `block` and `perform` share one
 * `validateBlockingShape`, which is also the gate the stdio transport reaches
 * (a tool call lands on these same methods after the controller's own argument
 * validation).
 *
 * Scenarios:
 *
 * 1. `block` with a non-array `coverage` violates at `$input.blocking.coverage`; a
 *    null entry violates at `[0]`; a non-string `camera` at `[0].camera`; an
 *    absent and a kind-less `on` at `[0].on`. None throws.
 * 2. Negative twins on the same tool: an explicit `null` coverage is the omitted
 *    single-camera beat and a well-formed entry blocks cleanly, so the floor
 *    never refuses a legitimate plan.
 * 3. `perform` gates the identical shape at the identical path, and its
 *    referential faults land on the same field: an unstaged coverage camera
 *    surfaces at `$input.blocking.coverage[0].camera` rather than under the
 *    engine's internal `$blocking` name, so one field speaks one path dialect.
 * 4. A well-formed coverage performs, and the alternate take reaches the result.
 */
export const test_mcp_blocking_coverage_shape = (): void => {
  // 1. structural floor on block.
  TestValidator.predicate(
    "a non-array coverage violates at the list",
    hasViolation(block("nope"), "type", "$input.blocking.coverage"),
  );
  TestValidator.predicate(
    "a null coverage entry violates at the entry",
    hasViolation(block([null]), "type", "$input.blocking.coverage[0]"),
  );
  TestValidator.predicate(
    "a non-string coverage camera violates at the camera",
    hasViolation(
      block([coverage({ camera: 42 as unknown as string })]),
      "type",
      "$input.blocking.coverage[0].camera",
    ),
  );
  TestValidator.predicate(
    "an absent coverage target violates at the target",
    hasViolation(
      block([{ camera: "cam-alt", framing: "medium", move: "static" }]),
      "type",
      "$input.blocking.coverage[0].on",
    ),
  );
  TestValidator.predicate(
    "a kind-less coverage target violates at the target",
    hasViolation(
      block([coverage({ on: { kind: "nope" } as unknown as ICoverage["on"] })]),
      "type",
      "$input.blocking.coverage[0].on",
    ),
  );

  // 2. negative twins: the floor refuses nothing legitimate.
  TestValidator.equals(
    "a null coverage is the single-camera beat",
    block(null).success,
    true,
  );
  TestValidator.equals(
    "a well-formed coverage blocks",
    block([coverage()]).success,
    true,
  );

  // 3. the same floor and the same path on perform.
  TestValidator.predicate(
    "perform gates a non-array coverage at the same path",
    hasViolation(perform("nope"), "type", "$input.blocking.coverage"),
  );
  TestValidator.predicate(
    "perform gates a targetless coverage entry at the same path",
    hasViolation(
      perform([{ camera: "cam-alt", framing: "medium", move: "static" }]),
      "type",
      "$input.blocking.coverage[0].on",
    ),
  );
  TestValidator.predicate(
    "an unstaged coverage camera is blamed on the blocking field",
    hasViolation(
      perform([coverage({ camera: "cam-ghost" })]),
      "type",
      "$input.blocking.coverage[0].camera",
    ),
  );

  // 4. the positive twin: a legitimate coverage reaches the result.
  const performed = perform([coverage()]);
  TestValidator.equals("a covered beat performs", performed.success, true);
  if (performed.success !== true) return;
  TestValidator.equals(
    "the alternate take rides the performed shot",
    performed.shot.coverage!.map((take) => take.camera),
    ["cam-alt"],
  );
};
