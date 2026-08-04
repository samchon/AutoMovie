import { Matrix4, resolveWorldDrivers } from "@automovie/engine";
import { IAutoMovieIKDriver, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const W = (p: IAutoMovieVector3): number[] =>
  Matrix4.compose(p, { x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 1, z: 1 });

const fabrik = (over: Partial<IAutoMovieIKDriver>): IAutoMovieIKDriver => ({
  type: "ik",
  chain: ["r", "m", "t"],
  goal: "g",
  pole: null,
  solver: "fabrik",
  iterations: 50,
  influence: 1,
  ...over,
});

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
 * The FABRIK iterative IK solver runs inside the engine's world pass (S2):
 * backward/forward position passes re-place every joint at its exact segment
 * length, an out-of-reach goal resolves directly as full extension toward it,
 * and the whole solve rides a fixed iteration budget for determinism.
 *
 * Scenarios:
 *
 * 1. A reachable goal converges (the tip lands within 1e-3 of the goal) and both
 *    segment lengths are preserved to 1e-9 (FABRIK re-places at exact lengths
 *    by construction).
 * 2. An unreachable goal is a closed form, not an iteration: every joint sits on
 *    the root→goal ray at its cumulative length, exactly.
 * 3. A four-node chain converges too: the long-chain case the analytic two-bone
 *    solver cannot express.
 * 4. The measure-zero degenerate where a backward pass lands two joints on the
 *    same point takes the deterministic fallback direction and still terminates
 *    with exact segment lengths.
 * 5. The same inputs replay identically.
 * 6. `influence: 0.5` blends the tip linearly toward the solved position.
 */
export const test_resolve_fabrik_ik = (): void => {
  // 1. reachable goal, exact lengths
  const w1 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([fabrik({})], w1, new Map(), new Map());
  TestValidator.predicate(
    "tip converges onto the goal",
    dist(at(w1, "t"), { x: 1.2, y: 0.5, z: 0 }) <= 1e-3,
  );
  TestValidator.predicate(
    "segment lengths exact",
    nclose(dist(at(w1, "r"), at(w1, "m")), 1, 1e-9) &&
      nclose(dist(at(w1, "m"), at(w1, "t")), 1, 1e-9),
  );

  // 2. unreachable goal → closed-form full extension along the ray
  const w2 = bentWorld({ x: 0, y: 5, z: 0 });
  resolveWorldDrivers([fabrik({})], w2, new Map(), new Map());
  TestValidator.predicate(
    "mid on the ray at its cumulative length",
    vclose(at(w2, "m"), { x: 0, y: 1, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "tip on the reachable shell toward the goal",
    vclose(at(w2, "t"), { x: 0, y: 2, z: 0 }, 1e-9),
  );

  // 3. four-node chain
  const w3 = new Map([
    ["a", W({ x: 0, y: 0, z: 0 })],
    ["b", W({ x: 1, y: 0, z: 0 })],
    ["c", W({ x: 2, y: 0, z: 0 })],
    ["d", W({ x: 3, y: 0, z: 0 })],
    ["g", W({ x: 1.5, y: 1.5, z: 0 })],
  ]);
  resolveWorldDrivers(
    [fabrik({ chain: ["a", "b", "c", "d"] })],
    w3,
    new Map(),
    new Map(),
  );
  TestValidator.predicate(
    "long chain converges",
    dist(at(w3, "d"), { x: 1.5, y: 1.5, z: 0 }) <= 1e-3,
  );
  TestValidator.predicate(
    "long chain keeps every segment length",
    nclose(dist(at(w3, "a"), at(w3, "b")), 1, 1e-9) &&
      nclose(dist(at(w3, "b"), at(w3, "c")), 1, 1e-9) &&
      nclose(dist(at(w3, "c"), at(w3, "d")), 1, 1e-9),
  );

  // 4. coincident-joint degenerate: straight chain folded onto its own mid
  const w4 = new Map([
    ["r", W({ x: 0, y: 0, z: 0 })],
    ["m", W({ x: 1, y: 0, z: 0 })],
    ["t", W({ x: 2, y: 0, z: 0 })],
    ["g", W({ x: 1, y: 0, z: 0 })],
  ]);
  resolveWorldDrivers([fabrik({})], w4, new Map(), new Map());
  TestValidator.predicate(
    "degenerate fold terminates with exact lengths",
    nclose(dist(at(w4, "r"), at(w4, "m")), 1, 1e-9) &&
      nclose(dist(at(w4, "m"), at(w4, "t")), 1, 1e-9),
  );

  // 5. determinism
  const w5 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([fabrik({})], w5, new Map(), new Map());
  TestValidator.predicate(
    "deterministic replay",
    vclose(at(w5, "m"), at(w1, "m"), 0) && vclose(at(w5, "t"), at(w1, "t"), 0),
  );

  // 6. influence blend
  const w6 = bentWorld({ x: 1.2, y: 0.5, z: 0 });
  resolveWorldDrivers([fabrik({ influence: 0.5 })], w6, new Map(), new Map());
  const solvedTip = at(w1, "t");
  TestValidator.predicate(
    "half influence blends the tip linearly",
    vclose(
      at(w6, "t"),
      {
        x: (1 + solvedTip.x) / 2,
        y: (1 + solvedTip.y) / 2,
        z: solvedTip.z / 2,
      },
      1e-9,
    ),
  );
};
