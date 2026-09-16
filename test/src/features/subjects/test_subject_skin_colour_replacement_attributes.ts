import {
  type IControlMesh,
  applyPortraitRegionReplacements,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { skinColourSquare } from "../internal/skinColourFixture";

/**
 * Generic deferred appenders preserve optional aligned attributes explicitly.
 *
 * Scenarios:
 * 1. A centre fan appends matching reference/RGB samples on an owned mesh.
 * 2. Dropping either new attribute entry refuses; absent attributes remain absent.
 */
export const test_subject_skin_colour_replacement_attributes = (): void => {
  const mesh = skinColourSquare();
  mesh.reference = structuredClone(mesh.positions);
  mesh.colors = mesh.positions.map(() => [0.5, 0.5, 0.5]);
  const before = structuredClone(mesh);
  const append = (cage: IControlMesh, boundary: readonly number[]) => {
    const id = cage.positions.push([0, 0, 0]) - 1;
    cage.reference?.push([0, 0, 0]);
    cage.colors?.push([0.5, 0.5, 0.5]);
    for (let i = 0; i < boundary.length; i++) {
      cage.indices.push(boundary[i], boundary[(i + 1) % boundary.length], id);
      cage.groups.push(0);
    }
  };
  const output = applyPortraitRegionReplacements(mesh, [{ group: 0, append }]);
  TestValidator.equals(
    "reference alignment",
    output.reference!.length,
    output.positions.length,
  );
  TestValidator.equals(
    "colour alignment",
    output.colors!.length,
    output.positions.length,
  );
  TestValidator.equals("input ownership", mesh, before);
  for (const key of ["reference", "colors"] as const)
    TestValidator.predicate(
      "missing appended attribute refuses",
      throwsError(
        () =>
          applyPortraitRegionReplacements(mesh, [
            {
              group: 0,
              append: (c, b) => {
                append(c, b);
                c[key]!.pop();
              },
            },
          ]),
        "aligned reference and colour",
      ),
    );
  const bare = applyPortraitRegionReplacements(skinColourSquare(), [
    { group: 0, append },
  ]);
  TestValidator.equals("no invented reference", bare.reference, undefined);
  TestValidator.equals("no invented RGB", bare.colors, undefined);
};
