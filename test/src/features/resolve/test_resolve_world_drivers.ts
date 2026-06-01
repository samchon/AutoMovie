import {
  Matrix4,
  Quaternion,
  childrenIndex,
  resolveWorldDrivers,
} from "@motica/engine";
import {
  IMoticaAimDriver,
  IMoticaIKDriver,
  IMoticaNode,
  IMoticaTransform,
  IMoticaVector3,
} from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const IDENTITY: IMoticaTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const W = (x: number, y: number, z: number): number[] =>
  Matrix4.compose(
    { x, y, z },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 1, y: 1, z: 1 },
  );

const aim = (over: Partial<IMoticaAimDriver>): IMoticaAimDriver => ({
  type: "aim",
  owner: "o",
  target: "t",
  aimAxis: { x: 0, y: 0, z: -1 },
  upAxis: { x: 0, y: 1, z: 0 },
  worldUp: { x: 0, y: 1, z: 0 },
  influence: 1,
  ...over,
});

/** Where the owner's aim axis points after the driver runs. */
const aimedDir = (
  world: Map<string, number[]>,
  aimAxis: IMoticaVector3,
): IMoticaVector3 =>
  Quaternion.rotateVector(Matrix4.decompose(world.get("o")!).rotation, aimAxis);

const runAim = (
  d: IMoticaAimDriver,
  ownerPos: IMoticaVector3,
  targetPos: IMoticaVector3,
): Map<string, number[]> => {
  const world = new Map<string, number[]>([
    ["o", W(ownerPos.x, ownerPos.y, ownerPos.z)],
    ["t", W(targetPos.x, targetPos.y, targetPos.z)],
  ]);
  resolveWorldDrivers([d], world, new Map(), new Map());
  return world;
};

/**
 * The world-space `aim` (look-at) driver: orient a node so its aim axis points
 * at a target, twisting toward `worldUp` for roll, blended by influence, with
 * the owner's subtree recomposed afterward.
 *
 * Scenarios:
 *
 * 1. Aiming `−Z` at a target on `+X` rotates the owner so its aim axis points
 *    along `+X` and its up axis stays generally up (the roll is applied).
 * 2. A target straight along `worldUp` leaves the roll undefined (the desired up
 *    projects to zero) and is skipped — the aim still points at the target.
 * 3. A driver whose up axis equals its aim axis makes the rolled up project to
 *    zero — the other half of the roll-skip guard — and still aims correctly.
 * 4. Influence 0 leaves the owner's original orientation untouched.
 * 5. A target already along the aim axis (parallel) and one directly behind it
 *    (antiparallel, for two axis choices) all resolve to pointing at the
 *    target.
 * 6. With a child node, the owner's rotation recomposes the child's world.
 * 7. A non-aim (`ik`) driver is returned deferred, not applied.
 */
export const test_resolve_world_drivers = (): void => {
  // 1. aim −Z at +X: aim axis → +X, up stays up
  const w1 = runAim(aim({}), { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
  TestValidator.predicate(
    "aim points at +X",
    vclose(aimedDir(w1, { x: 0, y: 0, z: -1 }), { x: 1, y: 0, z: 0 }, 1e-5),
  );
  const up1 = Quaternion.rotateVector(
    Matrix4.decompose(w1.get("o")!).rotation,
    { x: 0, y: 1, z: 0 },
  );
  TestValidator.predicate("up stays generally up", up1.y > 0.5);

  // 2. target straight up → roll skipped (desired up projects to zero)
  const w2 = runAim(aim({}), { x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 });
  TestValidator.predicate(
    "aim points up with roll skipped",
    vclose(aimedDir(w2, { x: 0, y: 0, z: -1 }), { x: 0, y: 1, z: 0 }, 1e-5),
  );

  // 3. up axis == aim axis → rolled up projects to zero (other skip branch)
  const w3 = runAim(
    aim({ upAxis: { x: 0, y: 0, z: -1 } }),
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "aim still points at +X with degenerate up",
    vclose(aimedDir(w3, { x: 0, y: 0, z: -1 }), { x: 1, y: 0, z: 0 }, 1e-5),
  );

  // 4. influence 0 → unchanged (aim axis still at rest −Z)
  const w4 = runAim(
    aim({ influence: 0 }),
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "influence 0 keeps original orientation",
    vclose(aimedDir(w4, { x: 0, y: 0, z: -1 }), { x: 0, y: 0, z: -1 }, 1e-5),
  );

  // 5. parallel + antiparallel (two axis choices)
  const wPar = runAim(aim({}), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -5 });
  TestValidator.predicate(
    "parallel aim unchanged",
    vclose(aimedDir(wPar, { x: 0, y: 0, z: -1 }), { x: 0, y: 0, z: -1 }, 1e-5),
  );
  const wAntiZ = runAim(aim({}), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 });
  TestValidator.predicate(
    "antiparallel (aim x small) flips to +Z",
    vclose(aimedDir(wAntiZ, { x: 0, y: 0, z: -1 }), { x: 0, y: 0, z: 1 }, 1e-5),
  );
  const wAntiX = runAim(
    aim({ aimAxis: { x: 1, y: 0, z: 0 } }),
    { x: 0, y: 0, z: 0 },
    { x: -5, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "antiparallel (aim x large) flips to −X",
    vclose(aimedDir(wAntiX, { x: 1, y: 0, z: 0 }), { x: -1, y: 0, z: 0 }, 1e-5),
  );

  // 6. subtree recompose: child follows the rotated owner. Aiming −Z up at a
  // target on +Y rotates the owner about X, so the child at local +Y swings to
  // world +Z.
  const nodes: IMoticaNode[] = [
    { ...node("o"), parent: null },
    { ...node("c"), parent: "o", transform: trs(0, 2, 0) },
  ];
  const world = new Map<string, number[]>([
    ["o", W(0, 0, 0)],
    ["c", W(0, 2, 0)],
    ["t", W(0, 5, 0)],
  ]);
  const localById = new Map<string, IMoticaTransform>([["c", trs(0, 2, 0)]]);
  resolveWorldDrivers([aim({})], world, localById, childrenIndex(nodes));
  const childPos = Matrix4.position(world.get("c")!);
  TestValidator.predicate(
    "child recomposed off the rotated owner",
    !vclose(childPos, { x: 0, y: 2, z: 0 }, 1e-3),
  );

  // 7. ik driver deferred
  const ik: IMoticaIKDriver = {
    type: "ik",
    chain: ["a", "b"],
    goal: "g",
    pole: null,
    solver: "twoBone",
    iterations: null,
    influence: 1,
  };
  const deferred = resolveWorldDrivers(
    [aim({}), ik],
    new Map([
      ["o", W(0, 0, 0)],
      ["t", W(5, 0, 0)],
    ]),
    new Map(),
    new Map(),
  );
  TestValidator.equals("ik deferred", deferred.length, 1);
  TestValidator.equals("ik is the deferred one", deferred[0]!.type, "ik");

  // childrenIndex: a root is skipped; a second child of one parent appends
  const idx = childrenIndex([
    { ...node("root"), parent: null },
    { ...node("a"), parent: "root" },
    { ...node("b"), parent: "root" },
  ]);
  TestValidator.equals(
    "two children indexed under one parent",
    idx.get("root"),
    ["a", "b"],
  );
  TestValidator.equals("root has no parent entry", idx.has("nope"), false);
  TestValidator.predicate("nclose available", nclose(1, 1));
};

const node = (id: string): IMoticaNode => ({
  id,
  name: null,
  parent: null,
  kind: "group",
  transform: IDENTITY,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const trs = (x: number, y: number, z: number): IMoticaTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
