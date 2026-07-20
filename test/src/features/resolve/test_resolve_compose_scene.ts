import { composeScene } from "@automovie/engine";
import { IAutoMovieNode, IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

const IDENTITY: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const node = (
  id: string,
  parent: string | null,
  tx: number,
): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform: { ...IDENTITY, translation: { x: tx, y: 0, z: 0 } },
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

/** Translation column of a column-major world matrix. */
const tx = (m: number[]): number => m[12]!;

/**
 * The COMPOSE pass: flat nodes → world matrices, walking parent-before-child
 * with on-demand parent resolution and memoization.
 *
 * Scenarios:
 *
 * 1. A lone root with no overrides composes from its own rest transform: a +1
 *    translation lands at x=1 in the world matrix.
 * 2. A child listed _before_ its parent still composes correctly: the parent is
 *    pulled in on demand, then the later loop iteration over the parent hits
 *    the memo cache. With an override on the child only (parent falls back to
 *    its rest transform), the child's world x is parent(10) + childOverride(2)
 *    = 12.
 */
export const test_resolve_compose_scene = (): void => {
  // 1. lone root, no overrides
  const root = composeScene([node("r", null, 1)]);
  TestValidator.predicate(
    "root world translation",
    nclose(tx(root.get("r")!), 1),
  );

  // 2. child-before-parent ordering + override on child only
  const overrides = new Map<string, IAutoMovieTransform>([
    ["c", { ...IDENTITY, translation: { x: 2, y: 0, z: 0 } }],
  ]);
  const world = composeScene(
    [node("c", "p", 1), node("p", null, 10)],
    overrides,
  );
  TestValidator.predicate(
    "parent world from rest transform",
    nclose(tx(world.get("p")!), 10),
  );
  TestValidator.predicate(
    "child world = parent rest + child override",
    nclose(tx(world.get("c")!), 12),
  );
  TestValidator.predicate(
    "duplicate node ids reject ambiguous graph",
    throwsError(
      () => composeScene([node("dup", null, 1), node("dup", null, 2)]),
      ['node id "dup"', "nodes[1].id"],
    ),
  );
  TestValidator.predicate(
    "missing parent rejects dangling graph",
    throwsError(
      () => composeScene([node("child", "missing", 1)]),
      ['node "child" references missing parent "missing"', "nodes[0].parent"],
    ),
  );
  TestValidator.predicate(
    "parent cycle rejects recursive graph",
    throwsError(
      () => composeScene([node("a", "b", 1), node("b", "a", 2)]),
      'node parent cycle includes "a"',
    ),
  );
};
