import { Matrix4, resolveWorldDrivers } from "@automovie/engine";
import { IAutoMovieIKDriver, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

const W = (p: IAutoMovieVector3): number[] =>
  Matrix4.compose(p, { x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 1, z: 1 });

const ccd = (over: Partial<IAutoMovieIKDriver>): IAutoMovieIKDriver => ({
  type: "ik",
  chain: ["r", "m", "t"],
  goal: "g",
  pole: null,
  solver: "ccd",
  iterations: 50,
  influence: 1,
  ...over,
});

/** A bent two-segment chain (lengths 1, 1) plus the goal, ready to solve. */
const bentWorld = (goal: IAutoMovieVector3): Map<string, number[]> =>
  new Map([
    ["r", W({ x: 0, y: 0, z: 0 })],
    ["m", W({ x: 1, y: 0, z: 0 })],
    ["t", W({ x: 1, y: 1, z: 0 })],
    ["g", W(goal)],
  ]);

const at = (world: Map<string, number[]>, id: string): IAutoMovieVector3 =>
  Matrix4.position(world.get(id)!);

const dist = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * The CCD iterative IK solver runs inside the engine's world pass (S2 of the
 * core wiring): back-to-front joint rotations swing the tip toward the goal on
 * a fixed iteration budget, so long chains solve deterministically without a
 * host-side pass. Rotations are rigid, so segment lengths survive exactly, and
 * `influence` blends the positional result linearly.
 *
 * Scenarios:
 *
 * 1. A reachable goal converges: the tip lands within 1e-3 of the goal and both
 *    unit segment lengths are preserved.
 * 2. The same inputs replay identically (fixed budget → determinism).
 * 3. An unreachable goal extends the chain fully toward it — the tip ends on the
 *    reachable shell pointing at what it cannot touch.
 * 4. `influence: 0.5` puts the tip exactly halfway between its original and its
 *    fully-solved position (the blend is linear by construction).
 * 5. `iterations: null` falls back to the documented default budget and still
 *    converges on an easy goal.
 * 6. A goal already on the tip early-outs without moving anything.
 * 7. Non-integer, non-positive, and non-finite iteration counts reject; a chain
 *    shorter than 2 nodes rejects; a zero-length segment rejects; missing chain
 *    or goal nodes reject; out-of-range influence rejects.
 * 8. A single-segment chain (the 2-node minimum) whose goal sits exactly behind it
 *    takes the antiparallel 180° flip — via both deterministic-perpendicular
 *    selections (an X-aligned and a Y-aligned segment).
 */
export const test_resolve_ccd_ik = (): void => {
  // 1. reachable goal converges, lengths preserved
  const w1 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([ccd({})], w1, new Map(), new Map());
  TestValidator.predicate(
    "tip converges onto the goal",
    dist(at(w1, "t"), { x: 1.2, y: 0.5, z: 0 }) <= 1e-3,
  );
  TestValidator.predicate(
    "upper segment length preserved",
    nclose(dist(at(w1, "r"), at(w1, "m")), 1, 1e-9),
  );
  TestValidator.predicate(
    "lower segment length preserved",
    nclose(dist(at(w1, "m"), at(w1, "t")), 1, 1e-9),
  );

  // 2. determinism
  const w2 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([ccd({})], w2, new Map(), new Map());
  TestValidator.predicate(
    "deterministic mid",
    vclose(at(w1, "m"), at(w2, "m"), 0),
  );
  TestValidator.predicate(
    "deterministic tip",
    vclose(at(w1, "t"), at(w2, "t"), 0),
  );

  // 3. unreachable goal → full extension toward it
  const w3 = bentWorld({ x: 0, y: 5, z: 0 });
  resolveWorldDrivers([ccd({})], w3, new Map(), new Map());
  TestValidator.predicate(
    "unreachable goal fully extends the chain",
    dist(at(w3, "t"), { x: 0, y: 2, z: 0 }) <= 1e-2,
  );
  TestValidator.predicate(
    "extension keeps segment lengths",
    nclose(dist(at(w3, "r"), at(w3, "m")), 1, 1e-9) &&
      nclose(dist(at(w3, "m"), at(w3, "t")), 1, 1e-9),
  );

  // 4. influence 0.5 = halfway between original and solved tip
  const w4 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([ccd({ influence: 0.5 })], w4, new Map(), new Map());
  const solvedTip = at(w1, "t");
  TestValidator.predicate(
    "half influence blends the tip linearly",
    vclose(
      at(w4, "t"),
      {
        x: (1 + solvedTip.x) / 2,
        y: (1 + solvedTip.y) / 2,
        z: solvedTip.z / 2,
      },
      1e-9,
    ),
  );

  // 5. null iterations → default budget still converges
  const w5 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([ccd({ iterations: null })], w5, new Map(), new Map());
  TestValidator.predicate(
    "default budget converges on an easy goal",
    dist(at(w5, "t"), { x: 1.2, y: 0.5, z: 0 }) <= 1e-3,
  );

  // 6. goal on the tip → early-out, nothing moves
  const w6 = bentWorld({ x: 1, y: 1, z: 0 });
  resolveWorldDrivers([ccd({})], w6, new Map(), new Map());
  TestValidator.predicate(
    "converged input early-outs unchanged",
    vclose(at(w6, "m"), { x: 1, y: 0, z: 0 }, 0) &&
      vclose(at(w6, "t"), { x: 1, y: 1, z: 0 }, 0),
  );

  // 7. guards
  const guard = (
    title: string,
    over: Partial<IAutoMovieIKDriver>,
    world: Map<string, number[]>,
    expected: string | string[],
  ): void =>
    TestValidator.predicate(
      title,
      throwsError(
        () => resolveWorldDrivers([ccd(over)], world, new Map(), new Map()),
        expected,
      ),
    );
  guard(
    "zero iterations reject",
    { iterations: 0 },
    bentWorld({ x: 1, y: 1, z: 0 }),
    ["iterative IK iterations", "positive integer", "0"],
  );
  guard(
    "fractional iterations reject",
    { iterations: 1.5 },
    bentWorld({ x: 1, y: 1, z: 0 }),
    ["iterative IK iterations", "1.5"],
  );
  guard(
    "NaN iterations reject",
    { iterations: Number.NaN },
    bentWorld({ x: 1, y: 1, z: 0 }),
    ["iterative IK iterations", "NaN"],
  );
  guard(
    "one-node chain rejects",
    { chain: ["r"] },
    bentWorld({ x: 1, y: 1, z: 0 }),
    ["iterative IK chain", "at least 2", "1"],
  );
  guard(
    "zero-length segment rejects",
    { chain: ["r", "r2", "t"] },
    new Map([
      ["r", W({ x: 0, y: 0, z: 0 })],
      ["r2", W({ x: 0, y: 0, z: 0 })],
      ["t", W({ x: 1, y: 0, z: 0 })],
      ["g", W({ x: 1, y: 1, z: 0 })],
    ]),
    ["iterative IK segment 0 length", "> 0"],
  );
  guard(
    "missing chain node rejects",
    { chain: ["r", "missing", "t"] },
    bentWorld({ x: 1, y: 1, z: 0 }),
    'iterative IK chain node "missing" was not provided',
  );
  guard(
    "missing goal rejects",
    { goal: "missing" },
    bentWorld({ x: 1, y: 1, z: 0 }),
    'iterative IK goal node "missing" was not provided',
  );
  guard(
    "influence above one rejects",
    { influence: 1.1 },
    bentWorld({ x: 1, y: 1, z: 0 }),
    ["iterative IK influence", "between 0 and 1"],
  );

  // 8. antiparallel 180° flip on a single-segment chain, both perp branches
  const w8x = new Map([
    ["r", W({ x: 0, y: 0, z: 0 })],
    ["t", W({ x: 1, y: 0, z: 0 })],
    ["g", W({ x: -2, y: 0, z: 0 })],
  ]);
  resolveWorldDrivers([ccd({ chain: ["r", "t"] })], w8x, new Map(), new Map());
  TestValidator.predicate(
    "X-aligned segment flips behind (unreachable shell)",
    vclose(at(w8x, "t"), { x: -1, y: 0, z: 0 }, 1e-9),
  );
  const w8y = new Map([
    ["r", W({ x: 0, y: 0, z: 0 })],
    ["t", W({ x: 0, y: 1, z: 0 })],
    ["g", W({ x: 0, y: -2, z: 0 })],
  ]);
  resolveWorldDrivers([ccd({ chain: ["r", "t"] })], w8y, new Map(), new Map());
  TestValidator.predicate(
    "Y-aligned segment flips behind (other perpendicular branch)",
    vclose(at(w8y, "t"), { x: 0, y: -1, z: 0 }, 1e-9),
  );
};
