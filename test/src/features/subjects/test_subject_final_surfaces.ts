import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitFinalSurfaceHost,
  applyPortraitFinalSurfaces,
} from "../../subjects/portraitFinalSurface";
import { throwsError } from "../internal/predicates";

/**
 * Final component geometry reads one immutable basis and composes by explicit
 * ownership, so part order cannot silently change a shared anatomical surface.
 *
 * Scenarios:
 * 1. Two independent proposals observe the same old positions and produce the
 *    same result in either order; a compatible shared request is accepted.
 * 2. Missing/empty hooks are identity. Input/output snapshots resist retained
 *    caller-array edits, and writes to every host buffer cannot take effect.
 * 3. Conflicting ownership, ambiguous provider IDs and malformed final targets
 *    refuse, beside valid zero and signed coordinates on resident boundaries.
 */
export const test_subject_final_surfaces = (): void => {
  const mesh = {
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    indices: [0, 1, 2],
    groups: [0],
  };
  const original = structuredClone(mesh);
  let observed: IPortraitFinalSurfaceHost | undefined;
  const a = {
    id: "first",
    propose: (host: IPortraitFinalSurfaceHost) => {
      observed = host;
      return [{ vertex: 0, target: [host.positions[0][0], 0, 1] }];
    },
  };
  const b = {
    id: "second",
    propose: (host: IPortraitFinalSurfaceHost) => {
      TestValidator.equals(
        "second provider still sees the original first vertex",
        host.positions[0],
        [0, 0, 0],
      );
      return [{ vertex: 1, target: [1, 0, -1] }];
    },
  };
  const result = applyPortraitFinalSurfaces(mesh, [a, b]);
  TestValidator.equals(
    "permutation preserves composed geometry",
    applyPortraitFinalSurfaces(mesh, [b, a]),
    result,
  );
  TestValidator.equals(
    "positions own the expected final result",
    result.positions,
    [
      [0, 0, 1],
      [1, 0, -1],
      [0, 1, 0],
    ],
  );
  TestValidator.equals("input geometry is unchanged", mesh, original);
  TestValidator.equals(
    "compatible shared ownership agrees",
    applyPortraitFinalSurfaces(mesh, [
      a,
      { id: "shared", propose: () => [{ vertex: 0, target: [0, 0, 1] }] },
    ]).positions[0],
    [0, 0, 1],
  );
  TestValidator.predicate(
    "no hooks preserve mesh identity",
    applyPortraitFinalSurfaces(mesh, []) === mesh,
  );
  TestValidator.predicate(
    "empty proposals preserve mesh identity",
    applyPortraitFinalSurfaces(mesh, [{ id: "empty", propose: () => [] }]) ===
      mesh,
  );
  const target = [0, 0, 2];
  const owned = applyPortraitFinalSurfaces(mesh, [
    { id: "owned", propose: () => [{ vertex: 2, target }] },
  ]);
  target[2] = 9;
  TestValidator.equals(
    "returned target arrays are copied",
    owned.positions[2],
    [0, 0, 2],
  );
  const sameBasis = {
    id: "basis",
    propose: (host: IPortraitFinalSurfaceHost) => {
      TestValidator.predicate(
        "providers share one identical immutable object",
        observed === host,
      );
      return [];
    },
  };
  applyPortraitFinalSurfaces(mesh, [a, sameBasis]);
  for (const select of [
    (host: IPortraitFinalSurfaceHost) => host.positions[0],
    (host: IPortraitFinalSurfaceHost) => host.indices,
    (host: IPortraitFinalSurfaceHost) => host.groups,
    (host: IPortraitFinalSurfaceHost) => host.normals,
  ])
    applyPortraitFinalSurfaces(mesh, [
      {
        id: "mutation",
        propose: (host) => {
          const buffer = select(host);
          const first = buffer[0];
          TestValidator.predicate(
            "host write cannot take effect",
            Reflect.set(buffer, 0, 9) === false,
          );
          TestValidator.equals(
            "host buffer retains its value",
            buffer[0],
            first,
          );
          return [];
        },
      },
    ]);
  TestValidator.predicate(
    "incompatible shared ownership refuses",
    throwsError(
      () =>
        applyPortraitFinalSurfaces(mesh, [
          a,
          { id: "conflict", propose: () => [{ vertex: 0, target: [0, 0, 2] }] },
        ]),
      "ownership",
    ),
  );
  for (const ids of [
    ["", "second"],
    ["same", "same"],
  ])
    TestValidator.predicate(
      "invalid owner identities refuse",
      throwsError(
        () =>
          applyPortraitFinalSurfaces(
            mesh,
            ids.map((id) => ({ id, propose: () => [] })),
          ),
        "identities",
      ),
    );
  for (const vertex of [-1, 0.5, 3])
    TestValidator.predicate(
      "invalid vertex refuses",
      throwsError(
        () =>
          applyPortraitFinalSurfaces(mesh, [
            { id: "vertex", propose: () => [{ vertex, target: [0, 0, 0] }] },
          ]),
        "resident vertex",
      ),
    );
  for (const target of [
    [0, 0],
    [0, 0, NaN],
    [0, 0, Infinity],
  ])
    TestValidator.predicate(
      "invalid XYZ refuses",
      throwsError(
        () =>
          applyPortraitFinalSurfaces(mesh, [
            { id: "target", propose: () => [{ vertex: 0, target }] },
          ]),
        "finite XYZ",
      ),
    );
};
