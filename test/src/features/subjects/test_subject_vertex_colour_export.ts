import { portraitDocument } from "@automovie/human/geometry/portraitDocument";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * Static facial export preserves RGB after placement and material grouping.
 *
 * Scenarios:
 * 1. Two grouped triangles retain RGB and an identity-white bare neighbour.
 * 2. Wholly bare geometry omits COLOR_0; out-of-range and incomplete RGB refuse.
 */
export const test_subject_vertex_colour_export = (): void => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const doc = portraitDocument(vertexColourModel([colored, bare]));
  const primitive = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
  const colors = primitive.getAttribute("COLOR_0")!;
  TestValidator.equals("RGB accessor type", colors.getType(), "VEC3");
  TestValidator.equals("merged linear RGB", Array.from(colors.getArray()!), [
    ...colored.colors!,
    ...new Array(9).fill(1),
  ]);
  TestValidator.equals("RGB count", colors.getCount(), 6);
  TestValidator.equals(
    "uncoloured export omits attribute",
    portraitDocument(vertexColourModel([bare]))
      .getRoot()
      .listMeshes()[0]!
      .listPrimitives()[0]!
      .getAttribute("COLOR_0"),
    null,
  );
  for (const invalid of [
    [2, ...colored.colors!.slice(1)],
    [1, 0, 0],
  ])
    TestValidator.predicate(
      "invalid RGB refused",
      throwsError(() =>
        portraitDocument(vertexColourModel([{ ...colored, colors: invalid }])),
      ),
    );
};
