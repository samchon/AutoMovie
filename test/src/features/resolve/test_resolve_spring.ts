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
 * 4. Invalid integration parameters reject before the integrator reads world or
 *    local transforms.
 * 5. A `center` reference subtracts body locomotion from inertia: after the
 *    center/root/joint translate together, the joint remains on its rest offset
 *    instead of whipping from the center's world delta.
 * 6. `hitRadius` is a physical collision radius and rejects non-finite or
 *    non-positive values before the integrator reads transform inputs.
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

  const invalid = (
    title: string,
    over: Partial<IAutoMovieSpringDriver>,
    dt: number,
    expected: string | string[],
  ): void =>
    TestValidator.predicate(
      title,
      throwsError(
        () =>
          stepSpring(
            { ...spring, ...over },
            new Map(),
            createSpringState(),
            dt,
            local,
          ),
        expected,
      ),
    );
  invalid("spring rejects NaN time step", {}, Number.NaN, [
    "spring driver time step",
    "finite",
    "NaN",
  ]);
  invalid("spring rejects zero time step", {}, 0, [
    "spring driver time step",
    "> 0",
    "0",
  ]);
  invalid("spring rejects NaN stiffness", { stiffness: Number.NaN }, 1 / 60, [
    "spring driver stiffness",
    "finite",
    "NaN",
  ]);
  invalid("spring rejects NaN drag", { drag: Number.NaN }, 1 / 60, [
    "spring driver drag",
    "finite",
    "NaN",
  ]);
  invalid("spring rejects negative drag", { drag: -0.1 }, 1 / 60, [
    "spring driver drag",
    "between 0 and 1",
    "-0.1",
  ]);
  invalid("spring rejects drag above one", { drag: 1.1 }, 1 / 60, [
    "spring driver drag",
    "between 0 and 1",
    "1.1",
  ]);
  invalid("spring rejects NaN hit radius", { hitRadius: Number.NaN }, 1 / 60, [
    "spring driver hitRadius",
    "finite",
    "NaN",
  ]);
  invalid(
    "spring rejects infinite hit radius",
    { hitRadius: Infinity },
    1 / 60,
    ["spring driver hitRadius", "finite", "Infinity"],
  );
  invalid("spring rejects zero hit radius", { hitRadius: 0 }, 1 / 60, [
    "spring driver hitRadius",
    "> 0",
    "0",
  ]);
  invalid("spring rejects negative hit radius", { hitRadius: -0.1 }, 1 / 60, [
    "spring driver hitRadius",
    "> 0",
    "-0.1",
  ]);
  invalid(
    "spring rejects infinite gravity power",
    { gravityPower: Infinity },
    1 / 60,
    ["spring driver gravityPower", "finite", "Infinity"],
  );
  invalid(
    "spring rejects non-finite gravity direction",
    { gravityDir: { x: Number.NaN, y: -1, z: 0 } },
    1 / 60,
    ["spring driver gravityDir.x", "finite", "NaN"],
  );
  invalid(
    "spring rejects zero gravity direction",
    { gravityDir: { x: 0, y: 0, z: 0 } },
    1 / 60,
    ["spring driver gravityDir", "non-zero"],
  );

  const centeredSpring: IAutoMovieSpringDriver = {
    ...spring,
    chain: ["root", "j1"],
    stiffness: 0,
    drag: 0,
    gravityPower: 0,
    center: "center",
  };
  const centeredWorld = new Map<string, number[]>([
    ["center", W({ x: 0, y: 0, z: 0 })],
    ["root", W({ x: 0, y: 0, z: 0 })],
    ["j1", W({ x: 1, y: 0, z: 0 })],
  ]);
  const centeredState = createSpringState();
  stepSpring(centeredSpring, centeredWorld, centeredState, 1 / 60, local);
  centeredWorld.set("center", W({ x: 0, y: 10, z: 0 }));
  centeredWorld.set("root", W({ x: 0, y: 10, z: 0 }));
  centeredWorld.set("j1", W({ x: 1, y: 10, z: 0 }));
  stepSpring(centeredSpring, centeredWorld, centeredState, 1 / 60, local);
  TestValidator.predicate(
    "center motion does not become spring inertia",
    vclose(at(centeredWorld, "j1"), { x: 1, y: 10, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "missing spring center rejects incomplete world map",
    throwsError(
      () =>
        stepSpring(
          { ...spring, center: "missing" },
          new Map(),
          createSpringState(),
          1 / 60,
          local,
        ),
      'spring driver center node "missing" was not provided',
    ),
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
