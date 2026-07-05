import { Matrix4, createSpringState, stepSpring } from "@automovie/engine";
import {
  IAutoMovieSpringDriver,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

const W = (p: IAutoMovieVector3): number[] =>
  Matrix4.compose(p, { x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 1, z: 1 });

const trs = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const spring: IAutoMovieSpringDriver = {
  type: "spring",
  chain: ["root", "j1", "j2"],
  stiffness: 0.3,
  drag: 0.1,
  gravityPower: 9.8,
  gravityDir: { x: 0, y: -1, z: 0 },
  hitRadius: 0.05,
  center: null,
};

const local = new Map<string, IAutoMovieTransform>([
  ["j1", trs(1, 0, 0)],
  ["j2", trs(1, 0, 0)],
]);

const at = (world: Map<string, number[]>, id: string): IAutoMovieVector3 =>
  Matrix4.position(world.get(id)!);

const dist = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Run `steps` of the spring from a fresh rest chain laid out along +X. */
const run = (steps: number): Map<string, number[]> => {
  const world = new Map<string, number[]>([
    ["root", W({ x: 0, y: 0, z: 0 })],
    ["j1", W({ x: 1, y: 0, z: 0 })],
    ["j2", W({ x: 2, y: 0, z: 0 })],
  ]);
  const state = createSpringState();
  for (let s = 0; s < steps; ++s)
    stepSpring(spring, world, state, 1 / 60, local);
  return world;
};

/**
 * The Verlet spring driver: a horizontal hair/skirt-like chain sags under
 * gravity, keeps its bone lengths, and replays identically.
 *
 * Scenarios:
 *
 * 1. After enough steps the chain laid out along +X has sagged downward — both
 *    joints sit below the rest line, the tip lower than the mid.
 * 2. Each bone keeps its rest length exactly (the hard length constraint), so the
 *    joints ride a unit sphere around their parent.
 * 3. The same inputs replay bit-for-bit (determinism — the property that makes
 *    spring usable in a reproducible render).
 */
export const test_resolve_spring = (): void => {
  const w = run(180);

  // 1. sagged under gravity
  TestValidator.predicate("mid joint sagged below rest", at(w, "j1").y < 0);
  TestValidator.predicate(
    "tip sags further than mid",
    at(w, "j2").y < at(w, "j1").y,
  );

  // 2. bone lengths preserved
  TestValidator.predicate(
    "upper bone length kept",
    nclose(dist(at(w, "root"), at(w, "j1")), 1, 1e-9),
  );
  TestValidator.predicate(
    "lower bone length kept",
    nclose(dist(at(w, "j1"), at(w, "j2")), 1, 1e-9),
  );

  // 3. deterministic replay
  const w2 = run(180);
  TestValidator.predicate(
    "deterministic mid",
    vclose(at(w, "j1"), at(w2, "j1"), 0),
  );
  TestValidator.predicate(
    "deterministic tip",
    vclose(at(w, "j2"), at(w2, "j2"), 0),
  );
  TestValidator.predicate(
    "missing spring parent rejects incomplete world map",
    throwsError(
      () =>
        stepSpring(
          spring,
          new Map([["j1", W({ x: 1, y: 0, z: 0 })]]),
          createSpringState(),
          1 / 60,
          local,
        ),
      'spring driver parent node "root" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing spring joint rejects incomplete world map",
    throwsError(
      () =>
        stepSpring(
          spring,
          new Map([["root", W({ x: 0, y: 0, z: 0 })]]),
          createSpringState(),
          1 / 60,
          local,
        ),
      'spring driver joint node "j1" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing spring local transform rejects incomplete local map",
    throwsError(
      () =>
        stepSpring(
          spring,
          new Map([
            ["root", W({ x: 0, y: 0, z: 0 })],
            ["j1", W({ x: 1, y: 0, z: 0 })],
          ]),
          createSpringState(),
          1 / 60,
          new Map(),
        ),
      'spring driver local transform node "j1" was not provided',
    ),
  );
};
