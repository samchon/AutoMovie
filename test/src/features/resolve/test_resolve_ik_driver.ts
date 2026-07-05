import { Matrix4, resolveWorldDrivers } from "@automovie/engine";
import {
  IAutoMovieIKDriver,
  IAutoMovieSpringDriver,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

const W = (p: IAutoMovieVector3): number[] =>
  Matrix4.compose(p, { x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 1, z: 1 });

const ik = (over: Partial<IAutoMovieIKDriver>): IAutoMovieIKDriver => ({
  type: "ik",
  chain: ["r", "m", "t"],
  goal: "g",
  pole: null,
  solver: "twoBone",
  iterations: null,
  influence: 1,
  ...over,
});

const dist = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const solve = (
  d: IAutoMovieIKDriver,
  root: IAutoMovieVector3,
  mid: IAutoMovieVector3,
  tip: IAutoMovieVector3,
  goal: IAutoMovieVector3,
  pole?: IAutoMovieVector3,
): Map<string, number[]> => {
  const world = new Map<string, number[]>([
    ["r", W(root)],
    ["m", W(mid)],
    ["t", W(tip)],
    ["g", W(goal)],
  ]);
  if (pole !== undefined) world.set("p", W(pole));
  resolveWorldDrivers([d], world, new Map(), new Map());
  return world;
};

const at = (world: Map<string, number[]>, id: string): IAutoMovieVector3 =>
  Matrix4.position(world.get(id)!);

/**
 * The analytic two-bone IK driver back-solves a `root → mid → tip` limb so its
 * tip reaches the goal, preserving bone lengths and bending in the pole's
 * plane.
 *
 * Scenarios:
 *
 * 1. A reachable goal with a pole: the tip lands on the goal and both bone lengths
 *    (1 and 1) are preserved.
 * 2. A goal at the root (zero direction) degrades gracefully to the limb's own
 *    axis rather than dividing by zero.
 * 3. A straight limb along X with no pole has an undefined bend plane → the
 *    free-perpendicular fallback (`cross` with +Y) picks one and the tip still
 *    reaches the goal.
 * 4. A straight limb along Y exercises the other fallback (`cross` with +X).
 * 5. A pole with a null node falls back to the limb's current bend plane.
 * 6. A null-node pole with a roll angle twists the bend plane around the goal.
 * 7. Non-twoBone (`ccd`), wrong-length, and `spring` drivers are deferred, not
 *    solved.
 * 8. Invalid influence and pole angle values reject before the analytic solve
 *    reads world matrices.
 * 9. Zero-length upper or lower bone segments reject before angle solving.
 */
export const test_resolve_ik_driver = (): void => {
  // 1. reachable + pole → tip on goal, lengths preserved
  const w1 = solve(
    ik({ pole: { node: "p", angle: 0 } }),
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1.2, y: 0.5, z: 0 },
    { x: 0.5, y: 1, z: 0 },
  );
  TestValidator.predicate(
    "tip reaches goal",
    vclose(at(w1, "t"), { x: 1.2, y: 0.5, z: 0 }, 1e-4),
  );
  TestValidator.predicate(
    "upper bone length preserved",
    nclose(dist(at(w1, "r"), at(w1, "m")), 1, 1e-4),
  );
  TestValidator.predicate(
    "lower bone length preserved",
    nclose(dist(at(w1, "m"), at(w1, "t")), 1, 1e-4),
  );

  // 2. goal at root → degenerate direction, no crash
  const w2 = solve(
    ik({}),
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "goal-at-root tip near root",
    dist(at(w2, "t"), { x: 0, y: 0, z: 0 }) < 0.01,
  );

  // 3. straight along X, no pole → fallback perpendicular (cross +Y)
  const w3 = solve(
    ik({}),
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 1.5, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "straight-X tip reaches goal",
    vclose(at(w3, "t"), { x: 1.5, y: 0, z: 0 }, 1e-4),
  );

  // 4. straight along Y → other fallback (cross +X)
  const w4 = solve(
    ik({}),
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 1.5, z: 0 },
  );
  TestValidator.predicate(
    "straight-Y tip reaches goal",
    vclose(at(w4, "t"), { x: 0, y: 1.5, z: 0 }, 1e-4),
  );

  // 5. pole present but node null → current-bend plane
  const w5 = solve(
    ik({ pole: { node: null, angle: 0 } }),
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1.2, y: 0.5, z: 0 },
  );
  TestValidator.predicate(
    "null-node pole still reaches goal",
    vclose(at(w5, "t"), { x: 1.2, y: 0.5, z: 0 }, 1e-4),
  );
  const w6 = solve(
    ik({ pole: { node: null, angle: 90 } }),
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 1.5, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "pole angle roll reaches goal",
    vclose(at(w6, "t"), { x: 1.5, y: 0, z: 0 }, 1e-4),
  );
  TestValidator.predicate(
    "pole angle roll preserves upper length",
    nclose(dist(at(w6, "r"), at(w6, "m")), 1, 1e-4),
  );
  TestValidator.predicate(
    "pole angle roll twists bend plane",
    vclose(at(w6, "m"), { x: 0.75, y: 0, z: 0.6614378277661477 }, 1e-4),
  );

  // 7. deferred: ccd solver, wrong-length chain, spring
  const spring: IAutoMovieSpringDriver = {
    type: "spring",
    chain: ["a", "b"],
    stiffness: 1,
    drag: 0.5,
    gravityPower: 1,
    gravityDir: { x: 0, y: -1, z: 0 },
    hitRadius: 0.1,
    center: null,
  };
  const deferred = resolveWorldDrivers(
    [ik({ solver: "ccd" }), ik({ chain: ["r", "m"] }), spring],
    new Map([
      ["r", W({ x: 0, y: 0, z: 0 })],
      ["m", W({ x: 1, y: 0, z: 0 })],
      ["t", W({ x: 2, y: 0, z: 0 })],
      ["g", W({ x: 1.5, y: 0, z: 0 })],
    ]),
    new Map(),
    new Map(),
  );
  TestValidator.equals("ccd / short / spring all deferred", deferred.length, 3);

  TestValidator.predicate(
    "two-bone IK rejects NaN influence",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ influence: Number.NaN })],
          new Map(),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK influence", "finite", "NaN"],
    ),
  );
  TestValidator.predicate(
    "two-bone IK rejects negative influence",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ influence: -0.1 })],
          new Map(),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK influence", "between 0 and 1", "-0.1"],
    ),
  );
  TestValidator.predicate(
    "two-bone IK rejects influence above one",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ influence: 1.1 })],
          new Map(),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK influence", "between 0 and 1", "1.1"],
    ),
  );
  TestValidator.predicate(
    "two-bone IK rejects NaN pole angle",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ pole: { node: null, angle: Number.NaN } })],
          new Map(),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK pole angle", "finite", "NaN"],
    ),
  );
  TestValidator.predicate(
    "two-bone IK rejects zero upper segment length",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({})],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["m", W({ x: 0, y: 0, z: 0 })],
            ["t", W({ x: 0, y: 1, z: 0 })],
            ["g", W({ x: 0, y: 1, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK upper bone length", "> 0"],
    ),
  );
  TestValidator.predicate(
    "two-bone IK rejects zero lower segment length",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({})],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["m", W({ x: 1, y: 0, z: 0 })],
            ["t", W({ x: 1, y: 0, z: 0 })],
            ["g", W({ x: 1, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      ["world driver two-bone IK lower bone length", "> 0"],
    ),
  );

  TestValidator.predicate(
    "missing IK root rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ chain: ["missing", "m", "t"] })],
          new Map([
            ["m", W({ x: 1, y: 0, z: 0 })],
            ["t", W({ x: 2, y: 0, z: 0 })],
            ["g", W({ x: 1.5, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      'world driver two-bone IK root node "missing" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing IK mid rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ chain: ["r", "missing", "t"] })],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["t", W({ x: 2, y: 0, z: 0 })],
            ["g", W({ x: 1.5, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      'world driver two-bone IK mid node "missing" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing IK tip rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ chain: ["r", "m", "missing"] })],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["m", W({ x: 1, y: 0, z: 0 })],
            ["g", W({ x: 1.5, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      'world driver two-bone IK tip node "missing" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing IK goal rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ goal: "missing" })],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["m", W({ x: 1, y: 0, z: 0 })],
            ["t", W({ x: 2, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      'world driver two-bone IK goal node "missing" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing IK pole rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [ik({ pole: { node: "missing", angle: 0 } })],
          new Map([
            ["r", W({ x: 0, y: 0, z: 0 })],
            ["m", W({ x: 1, y: 0, z: 0 })],
            ["t", W({ x: 2, y: 0, z: 0 })],
            ["g", W({ x: 1.5, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      'world driver two-bone IK pole node "missing" was not provided',
    ),
  );
};
