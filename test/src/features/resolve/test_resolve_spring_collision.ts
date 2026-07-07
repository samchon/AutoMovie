import { Matrix4, createSpringState, stepSpring } from "@automovie/engine";
import {
  IAutoMovieSpringDriver,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError, vclose } from "../internal/predicates";

const W = (p: IAutoMovieVector3): number[] =>
  Matrix4.compose(p, { x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 1, z: 1 });

const trs = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** Weightless, force-free spring: the joint stays put unless a collider acts. */
const still: IAutoMovieSpringDriver = {
  type: "spring",
  chain: ["root", "j1"],
  stiffness: 0,
  drag: 0,
  gravityPower: 0,
  gravityDir: { x: 0, y: -1, z: 0 },
  hitRadius: 0.05,
  center: null,
};

const local = new Map<string, IAutoMovieTransform>([["j1", trs(1, 0, 0)]]);

const world = (): Map<string, number[]> =>
  new Map([
    ["root", W({ x: 0, y: 0, z: 0 })],
    ["j1", W({ x: 1, y: 0, z: 0 })],
  ]);

const at = (w: Map<string, number[]>, id: string): IAutoMovieVector3 =>
  Matrix4.position(w.get(id)!);

/**
 * `stepSpring`'s sphere colliders complete the VRM SpringBone semantics the
 * validated `hitRadius` always declared: after the length constraint each joint
 * is pushed out of every penetrated sphere to its surface plus `hitRadius`, in
 * array order, with a deterministic upward fallback when the joint sits exactly
 * on a center.
 *
 * Scenarios:
 *
 * 1. A sphere the joint penetrates pushes it out to `radius + hitRadius` along the
 *    center→joint direction.
 * 2. A sphere it does not penetrate leaves the step identical to a collider-free
 *    run (the negative twin).
 * 3. A joint exactly on the sphere center takes the deterministic `+Y` fallback
 *    direction.
 * 4. Colliders apply in array order — a second sphere sees the first push's
 *    result.
 * 5. Non-positive and non-finite collider radii and a non-finite center reject
 *    before the integrator reads transforms.
 */
export const test_resolve_spring_collision = (): void => {
  // 1. push-out: sphere at the parent, min distance 1.2 + 0.05
  const w1 = world();
  stepSpring(still, w1, createSpringState(), 1 / 60, local, [
    { center: { x: 0, y: 0, z: 0 }, radius: 1.2 },
  ]);
  TestValidator.predicate(
    "penetrated sphere pushes to surface + hitRadius",
    vclose(at(w1, "j1"), { x: 1.25, y: 0, z: 0 }, 1e-9),
  );

  // 2. negative twin: sphere too small to touch
  const w2 = world();
  stepSpring(still, w2, createSpringState(), 1 / 60, local, [
    { center: { x: 0, y: 0, z: 0 }, radius: 0.5 },
  ]);
  TestValidator.predicate(
    "non-penetrated sphere leaves the joint at rest",
    vclose(at(w2, "j1"), { x: 1, y: 0, z: 0 }, 1e-9),
  );

  // 3. joint exactly on the center → deterministic +Y fallback
  const w3 = world();
  stepSpring(still, w3, createSpringState(), 1 / 60, local, [
    { center: { x: 1, y: 0, z: 0 }, radius: 0.3 },
  ]);
  TestValidator.predicate(
    "center-coincident joint escapes along +Y",
    vclose(at(w3, "j1"), { x: 1, y: 0.35, z: 0 }, 1e-9),
  );

  // 4. array order: the second sphere sees the first push's result
  const w4 = world();
  stepSpring(still, w4, createSpringState(), 1 / 60, local, [
    { center: { x: 1, y: 0, z: 0 }, radius: 0.3 },
    { center: { x: 1, y: 0.35, z: 0 }, radius: 0.2 },
  ]);
  TestValidator.predicate(
    "sequential spheres compound in order",
    vclose(at(w4, "j1"), { x: 1, y: 0.6, z: 0 }, 1e-9),
  );

  // 5. guards
  const invalid = (
    title: string,
    collider: { center: IAutoMovieVector3; radius: number },
    expected: string | string[],
  ): void =>
    TestValidator.predicate(
      title,
      throwsError(
        () =>
          stepSpring(still, world(), createSpringState(), 1 / 60, local, [
            collider,
          ]),
        expected,
      ),
    );
  invalid(
    "zero collider radius rejects",
    { center: { x: 0, y: 0, z: 0 }, radius: 0 },
    ["colliders[0].radius", "> 0"],
  );
  invalid(
    "negative collider radius rejects",
    { center: { x: 0, y: 0, z: 0 }, radius: -1 },
    ["colliders[0].radius", "> 0", "-1"],
  );
  invalid(
    "NaN collider radius rejects",
    { center: { x: 0, y: 0, z: 0 }, radius: Number.NaN },
    ["colliders[0].radius", "finite", "NaN"],
  );
  invalid(
    "non-finite collider center rejects",
    { center: { x: Number.NaN, y: 0, z: 0 }, radius: 1 },
    ["colliders[0].center.x", "finite", "NaN"],
  );
};
