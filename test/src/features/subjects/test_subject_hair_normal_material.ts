import {
  type IPortraitHairShape,
  buildPortraitHairCards,
  createPortraitHairMaterial,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * Normal strength owns shading only, including when a base finish is shared.
 * Scenarios:
 * 1. Zero and omission retain the exact derived finish, even with an authored
 *    base normal. Positive strengths replace only the card's normal binding.
 * 2. The full geometry is identical at zero, fractional and maximum strength.
 * 3. Adjacent limits, infinities, NaN and untyped null refuse in both public
 *    owners, including empty grooms that do not need a generated material.
 */
export const test_subject_hair_normal_material = (): void => {
  const finish = {
    ...createModel(null).materials[0],
    normalTexture: "authored-normal",
    normalScale: -0.5,
  };
  const shape: IPortraitHairShape = {
    material: finish.id,
    cards: [
      {
        guide: [
          [0, 0, 0],
          [0, 10, 0],
        ],
        across: [
          [1, 0, 0],
          [1, 0, 0],
        ],
        width: 2,
      },
    ],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 1,
    fibres: 1,
    coverage: 0.7,
  };
  const before = structuredClone({ finish, shape });
  const original = createPortraitHairMaterial(finish, shape);
  const geometry = buildPortraitHairCards(shape);
  TestValidator.equals(
    "zero preserves finish",
    createPortraitHairMaterial(finish, { ...shape, fibreNormalScale: 0 }),
    original,
  );
  TestValidator.equals(
    "zero preserves geometry",
    buildPortraitHairCards({ ...shape, fibreNormalScale: 0 }),
    geometry,
  );
  for (const fibreNormalScale of [0.4, 1]) {
    const changed = { ...shape, fibreNormalScale };
    const material = createPortraitHairMaterial(finish, changed);
    TestValidator.predicate(
      "owned generated normal",
      typeof material.normalTexture === "string" &&
        material.normalTexture.startsWith("data:image/png;base64,"),
    );
    TestValidator.equals(
      "requested strength",
      material.normalScale,
      fibreNormalScale,
    );
    const preserved: typeof original = {
      ...material,
      normalTexture: original.normalTexture,
      normalScale: original.normalScale,
    };
    TestValidator.equals("unrelated finish unchanged", preserved, original);
    TestValidator.equals(
      "no geometry change",
      buildPortraitHairCards(changed),
      geometry,
    );
  }
  for (const fibreNormalScale of [
    -0.01,
    1.01,
    Infinity,
    -Infinity,
    NaN,
    null as unknown as number,
  ]) {
    const invalid = { ...shape, cards: [], fibreNormalScale };
    TestValidator.predicate(
      "material rejects invalid scale",
      throwsError(() => createPortraitHairMaterial(finish, invalid)),
    );
    TestValidator.predicate(
      "empty groom rejects invalid scale",
      throwsError(() => buildPortraitHairCards(invalid)),
    );
  }
  TestValidator.equals("inputs unchanged", { finish, shape }, before);
};
