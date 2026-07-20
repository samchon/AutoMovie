import { createSpringState, resolveFrame } from "@automovie/engine";
import {
  IAutoMovieIKDriver,
  IAutoMovieNode,
  IAutoMovieSpringDriver,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError, vclose } from "../internal/predicates";

const node = (
  id: string,
  parent: string | null,
  translation: IAutoMovieVector3,
): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform: {
    translation,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const nodes = (): IAutoMovieNode[] => [
  node("root", null, { x: 0, y: 0, z: 0 }),
  node("j1", "root", { x: 1, y: 0, z: 0 }),
];

const spring: IAutoMovieSpringDriver = {
  type: "spring",
  chain: ["root", "j1"],
  stiffness: 0,
  drag: 0,
  gravityPower: 9.8,
  gravityDir: { x: 0, y: -1, z: 0 },
  hitRadius: 0.05,
  center: null,
};

const DT = 1 / 60;
/** Gravity displacement for one step: `gravityPower · dt²`. */
const H = 9.8 * DT * DT;

const at = (world: Map<string, number[]>, id: string): IAutoMovieVector3 => {
  const m = world.get(id)!;
  return { x: m[12]!, y: m[13]!, z: m[14]! };
};

/**
 * Springs step inside {@link resolveFrame} when the caller threads the
 * cross-frame `springs` input (state + dt + colliders), completing S2: the
 * engine advances the one stateful driver deterministically instead of
 * deferring it to a host pass. Without the input the deferral contract is
 * byte-identical to before.
 *
 * Scenarios:
 *
 * 1. No `springs` input → the spring driver comes back in `deferredDrivers`,
 *    exactly as before S2.
 * 2. With state+dt the first step matches the closed-form Verlet oracle: from
 *    rest, gravity pulls the joint down by `g·dt²` and the hard length
 *    constraint re-normalizes it onto the unit sphere around its parent.
 * 3. A second frame accumulates: the state seeds the joint from its previous
 *    post-spring position (the carried-world semantics), matching the update
 *    law applied by hand, sagging strictly further; and the two-frame sequence
 *    replays deterministically from a fresh state.
 * 4. A node-attached collider the joint penetrates pushes it out to the sphere
 *    surface plus `hitRadius`; a smaller sphere that never triggers leaves the
 *    result identical to the collider-free step.
 * 5. A collider naming a missing node rejects loudly.
 * 6. A non-spring driver still deferred by the world pass is untouched by the
 *    spring step: `springs` consumes only springs.
 */
export const test_resolve_frame_spring = (): void => {
  // 1. byte-compat: no springs input → deferred
  const out1 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    seconds: 0,
  });
  TestValidator.equals(
    "spring defers without state",
    out1.deferredDrivers.length,
    1,
  );
  TestValidator.equals(
    "the deferred one is the spring",
    out1.deferredDrivers[0]!.type,
    "spring",
  );

  // 2. first-step oracle
  const len = Math.hypot(1, H);
  const expected1: IAutoMovieVector3 = { x: 1 / len, y: -H / len, z: 0 };
  const state2 = createSpringState();
  const out2 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: { state: state2, dt: DT },
    seconds: 0,
  });
  TestValidator.equals("spring consumed", out2.deferredDrivers.length, 0);
  TestValidator.predicate(
    "first step matches the Verlet oracle",
    vclose(at(out2.world, "j1"), expected1, 1e-9),
  );

  // 3. second frame accumulates per the update law, deterministically
  const inertia: IAutoMovieVector3 = {
    x: expected1.x - 1,
    y: expected1.y,
    z: 0,
  };
  const raw2: IAutoMovieVector3 = {
    x: expected1.x + inertia.x,
    y: expected1.y + inertia.y - H,
    z: 0,
  };
  const len2 = Math.hypot(raw2.x, raw2.y);
  const expected2: IAutoMovieVector3 = {
    x: raw2.x / len2,
    y: raw2.y / len2,
    z: 0,
  };
  const out3 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: { state: state2, dt: DT },
    seconds: 0,
  });
  TestValidator.predicate(
    "second step matches the hand-applied update law",
    vclose(at(out3.world, "j1"), expected2, 1e-9),
  );
  TestValidator.predicate(
    "sag accumulates across frames",
    at(out3.world, "j1").y < at(out2.world, "j1").y,
  );
  const replayState = createSpringState();
  resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: { state: replayState, dt: DT },
    seconds: 0,
  });
  const replay2 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: { state: replayState, dt: DT },
    seconds: 0,
  });
  TestValidator.predicate(
    "two-frame sequence replays deterministically",
    vclose(at(replay2.world, "j1"), at(out3.world, "j1"), 0),
  );

  // 4. collider push-out + no-trigger twin
  const out4 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: {
      state: createSpringState(),
      dt: DT,
      colliders: [{ node: "root", radius: 1.2 }],
    },
    seconds: 0,
  });
  TestValidator.predicate(
    "penetrated collider pushes the joint to surface + hitRadius",
    vclose(
      at(out4.world, "j1"),
      {
        x: expected1.x * 1.25,
        y: expected1.y * 1.25,
        z: 0,
      },
      1e-9,
    ),
  );
  const out5 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring],
    springs: {
      state: createSpringState(),
      dt: DT,
      colliders: [{ node: "root", radius: 0.5 }],
    },
    seconds: 0,
  });
  TestValidator.predicate(
    "non-penetrated collider leaves the step untouched",
    vclose(at(out5.world, "j1"), expected1, 1e-9),
  );

  // 5. missing collider node rejects
  TestValidator.predicate(
    "missing collider node rejects",
    throwsError(
      () =>
        resolveFrame({
          nodes: nodes(),
          clip: null,
          limits: [],
          drivers: [spring],
          springs: {
            state: createSpringState(),
            dt: DT,
            colliders: [{ node: "nope", radius: 0.5 }],
          },
          seconds: 0,
        }),
      'world driver spring collider node "nope" was not provided',
    ),
  );

  // 6. springs consumes only springs: other deferrals pass through
  const shortIk: IAutoMovieIKDriver = {
    type: "ik",
    chain: ["root", "j1"],
    goal: "j1",
    pole: null,
    solver: "twoBone",
    iterations: null,
    influence: 1,
  };
  const out6 = resolveFrame({
    nodes: nodes(),
    clip: null,
    limits: [],
    drivers: [spring, shortIk],
    springs: { state: createSpringState(), dt: DT },
    seconds: 0,
  });
  TestValidator.equals(
    "short two-bone chain still deferred",
    out6.deferredDrivers.length,
    1,
  );
  TestValidator.equals(
    "the survivor is the ik",
    out6.deferredDrivers[0]!.type,
    "ik",
  );
};
