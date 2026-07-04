import { validateModel } from "@automovie/engine";
import {
  automoviePrimitiveShape,
  IautomovieModelPart,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const part = (
  id: string,
  shape: automoviePrimitiveShape,
): IautomovieModelPart => ({
  id,
  name: id,
  geometry: { type: "primitive", shape },
  material: null,
  attachedBone: null,
  transform: null,
});

/**
 * Primitive extent validation must cover every shape variant, not just the box.
 * Each non-box primitive routes through its own arm of the dimension selector,
 * and a non-positive dimension on any of them is a `range` violation. Pins the
 * sphere / plane / cylinder / cone branches the box-only extent test misses.
 *
 * Scenario: a model with four bad parts ??a zero-radius sphere, a zero-width
 * plane, a zero-height cylinder, and a zero-radius cone. Validation must fail,
 * flagging the offending dimension of each (`radius`, `width`, `height`).
 */
export const test_validation_model_extent_shapes = (): void => {
  const model = {
    ...createModel(),
    materials: [],
    parts: [
      part("sphere", { type: "sphere", radius: 0 }),
      part("plane", { type: "plane", width: 0, depth: 1 }),
      part("cylinder", { type: "cylinder", radius: 0.2, height: 0 }),
      part("cone", { type: "cone", radius: 0, height: 1 }),
    ],
  };
  const result = validateModel({ model });
  TestValidator.equals("bad extents fail", result.success, false);
  TestValidator.predicate(
    "sphere/cone radius flagged",
    hasViolation(result, "range", ".radius"),
  );
  TestValidator.predicate(
    "plane width flagged",
    hasViolation(result, "range", ".width"),
  );
  TestValidator.predicate(
    "cylinder height flagged",
    hasViolation(result, "range", ".height"),
  );
};
