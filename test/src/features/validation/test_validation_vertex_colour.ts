import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";
import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * RGB is a complete finite multiplier, never a partial or HDR buffer.
 *
 * Scenarios:
 * 1. Omission and exact zero/one boundaries are admitted.
 * 2. Empty, incomplete and extra tuples refuse at the colour buffer.
 * 3. Negative, above-one, NaN and infinite channels refuse at that channel;
 *    replacing only that channel with a boundary value restores validity.
 */
export const test_validation_vertex_colour = (): void => {
  const mesh = vertexColourMesh();
  const { colors: _colors, ...bare } = mesh;
  const check = (colors: number[]) =>
    validateModel({ model: vertexColourModel([{ ...mesh, colors }]) });
  TestValidator.equals(
    "omitted colours",
    validateModel({ model: vertexColourModel([bare]) }).success,
    true,
  );
  TestValidator.equals("boundary colours", check(mesh.colors!).success, true);
  for (const colors of [[], [1, 0], [1, 0, 0], [...mesh.colors!, 1, 1, 1]])
    TestValidator.predicate(
      "unaligned colour buffer",
      hasViolation(
        check(colors),
        "type",
        "$input.parts[0].geometry.mesh.colors",
      ),
    );
  for (const value of [
    -Number.EPSILON,
    1 + Number.EPSILON,
    NaN,
    Infinity,
    -Infinity,
  ]) {
    const colors = [...mesh.colors!];
    colors[4] = value;
    TestValidator.predicate(
      "invalid colour scalar",
      hasViolation(
        check(colors),
        "range",
        "$input.parts[0].geometry.mesh.colors[4]",
      ),
    );
    colors[4] = 0;
    TestValidator.equals("adjacent valid scalar", check(colors).success, true);
  }
};
