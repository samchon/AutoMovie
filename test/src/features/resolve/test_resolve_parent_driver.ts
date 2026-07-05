import { Matrix4, resolveWorldDrivers } from "@automovie/engine";
import {
  IAutoMovieParentDriver,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { qclose, throwsError, vclose } from "../internal/predicates";

const W = (
  pos: IAutoMovieVector3,
  rot: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 },
  scl: IAutoMovieVector3 = { x: 1, y: 1, z: 1 },
): number[] => Matrix4.compose(pos, rot, scl);

const parent = (
  over: Partial<IAutoMovieParentDriver>,
): IAutoMovieParentDriver => ({
  type: "parent",
  owner: "o",
  parent: "p",
  translation: false,
  rotation: false,
  scale: false,
  ...over,
});

const trs = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * The world-space `parent` (Child-Of) driver: the owner inherits the parent
 * node's world frame per component, keeping its own value where a flag is off,
 * and recomposes its subtree.
 *
 * Scenarios:
 *
 * 1. All flags on: the owner snaps to the parent's full world frame — position,
 *    rotation (90° about Y), and scale (×2) — and its child recomposes off the
 *    new frame.
 * 2. All flags off: the owner is left exactly as it was (each component takes its
 *    own value), proving the off-side of every flag.
 * 3. Malformed component flags reject before truthy/falsy coercion can change
 *    which parent frame components are inherited.
 */
export const test_resolve_parent_driver = (): void => {
  const s = Math.SQRT1_2;
  const parentRot = { x: 0, y: s, z: 0, w: s };
  const parentScale = { x: 2, y: 2, z: 2 };

  // 1. inherit the whole frame, child follows
  const world = new Map<string, number[]>([
    ["o", W({ x: 0, y: 0, z: 0 })],
    ["c", W({ x: 0, y: 1, z: 0 })],
    ["p", W({ x: 10, y: 0, z: 0 }, parentRot, parentScale)],
  ]);
  const localById = new Map<string, IAutoMovieTransform>([["c", trs(0, 1, 0)]]);
  const children = new Map<string, string[]>([["o", ["c"]]]);
  resolveWorldDrivers(
    [parent({ translation: true, rotation: true, scale: true })],
    world,
    localById,
    children,
  );
  const own = Matrix4.decompose(world.get("o")!);
  TestValidator.predicate(
    "owner inherits parent position",
    vclose(own.position, { x: 10, y: 0, z: 0 }, 1e-5),
  );
  TestValidator.predicate(
    "owner inherits parent scale",
    vclose(own.scale, parentScale, 1e-5),
  );
  TestValidator.predicate(
    "owner inherits parent rotation",
    qclose(own.rotation, parentRot, 1e-5),
  );
  TestValidator.predicate(
    "child recomposed off the new owner frame",
    !vclose(Matrix4.position(world.get("c")!), { x: 0, y: 1, z: 0 }, 1e-3),
  );

  // 2. all flags off → owner unchanged
  const world2 = new Map<string, number[]>([
    ["o", W({ x: 3, y: 4, z: 5 })],
    ["p", W({ x: 10, y: 0, z: 0 }, parentRot, parentScale)],
  ]);
  resolveWorldDrivers([parent({})], world2, new Map(), new Map());
  TestValidator.predicate(
    "all flags off leaves the owner put",
    vclose(Matrix4.position(world2.get("o")!), { x: 3, y: 4, z: 5 }, 1e-5),
  );

  TestValidator.predicate(
    "parent driver rejects non-boolean component flag",
    throwsError(
      () =>
        resolveWorldDrivers(
          [
            parent({
              translation: "yes" as unknown as boolean,
            }),
          ],
          new Map([
            ["o", W({ x: 0, y: 0, z: 0 })],
            ["p", W({ x: 10, y: 0, z: 0 })],
          ]),
          new Map(),
          new Map(),
        ),
      ["world driver parent translation", "boolean", "yes"],
    ),
  );

  TestValidator.predicate(
    "missing parent-driver owner rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [parent({ owner: "missing", translation: true })],
          new Map([["p", W({ x: 10, y: 0, z: 0 })]]),
          new Map(),
          new Map(),
        ),
      'world driver parent owner node "missing" was not provided',
    ),
  );
  TestValidator.predicate(
    "missing parent-driver parent rejects incomplete world map",
    throwsError(
      () =>
        resolveWorldDrivers(
          [parent({ parent: "missing", translation: true })],
          new Map([["o", W({ x: 0, y: 0, z: 0 })]]),
          new Map(),
          new Map(),
        ),
      'world driver parent parent node "missing" was not provided',
    ),
  );
};
