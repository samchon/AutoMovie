import { validateModel } from "@automovie/engine";
import { createPortraitHairMaterial } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * Hair mask controls are independent of geometry and other base-finish users.
 * Scenarios:
 * 1. Omission gives 0.45; authored zero, 0.25 and one retain their exact cutoff.
 * 2. Derivation keeps finish fields, copies nested colour and leaves inputs unchanged.
 * 3. The model's material validator rejects out-of-range and nonfinite cutoffs.
 */
export const test_subject_hair_material = (): void => {
  const model = createModel(null),
    finish = model.materials[0];
  const shape = { seed: 4, fibres: 2, coverage: 0.7 };
  const before = structuredClone({ finish, shape });
  TestValidator.predicate("valid fixture", validateModel({ model }).success);
  const derived = createPortraitHairMaterial(finish, shape);
  TestValidator.equals("default cutoff", derived.alphaCutoff, 0.45);
  TestValidator.equals(
    "independent mask identity",
    [derived.id, derived.name, derived.alphaMode, derived.doubleSided],
    [finish.id + ":hair-cards", finish.id + ":hair-cards", "mask", true],
  );
  TestValidator.equals(
    "finish colour retained",
    derived.baseColor,
    finish.baseColor,
  );
  TestValidator.predicate(
    "nested finish owned",
    derived.baseColor !== finish.baseColor,
  );
  TestValidator.equals("inputs unchanged", { finish, shape }, before);
  for (const alphaCutoff of [0, 0.25, 1]) {
    const material = createPortraitHairMaterial(
      { ...finish, alphaMode: "mask", alphaCutoff },
      shape,
    );
    TestValidator.equals("authored cutoff", material.alphaCutoff, alphaCutoff);
    TestValidator.equals(
      "mask pixels unchanged",
      material.baseColorTexture,
      derived.baseColorTexture,
    );
    TestValidator.predicate(
      "inclusive cutoff admitted",
      validateModel({
        model: { ...model, materials: [...model.materials, material] },
      }).success,
    );
  }
  for (const alphaCutoff of [-0.01, 1.01, NaN]) {
    const invalid = structuredClone(model);
    invalid.materials.push(
      createPortraitHairMaterial(
        { ...finish, alphaMode: "mask", alphaCutoff },
        shape,
      ),
    );
    TestValidator.predicate(
      "invalid cutoff refused by model owner",
      !validateModel({ model: invalid }).success,
    );
  }
};
