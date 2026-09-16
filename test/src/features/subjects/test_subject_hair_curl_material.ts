import {
  type IPortraitHairShape,
  buildPortraitHairCards,
  createPortraitHairMaterial,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * A curl profile changes only the owned card finish and survives exact replay.
 * Scenarios:
 * 1. Optional omission retains the previous finish; enabling curl changes its
 *    mask and normal but not geometry, base pigment or caller-owned objects.
 * 2. Zero normal strength keeps the original base normal while still producing
 *    the curled alpha mask.
 */
export const test_subject_hair_curl_material = (): void => {
  const finish = {
    ...createModel(null).materials[0],
    normalTexture: "base-normal",
    normalScale: 0.2,
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
    coverage: 1,
    fibreNormalScale: 0.4,
  };
  const before = structuredClone({ shape, finish }),
    legacy = createPortraitHairMaterial(finish, shape);
  TestValidator.equals(
    "omission exact",
    createPortraitHairMaterial(finish, { ...shape, fibreCurl: undefined }),
    legacy,
  );
  const curled = {
    ...shape,
    fibreCurl: { amplitude: 0.2, cycles: 3, aspectRatio: 0.5 },
  };
  const result = createPortraitHairMaterial(finish, curled);
  TestValidator.predicate(
    "two pattern slots change",
    result.baseColorTexture !== legacy.baseColorTexture &&
      result.normalTexture !== legacy.normalTexture,
  );
  TestValidator.equals(
    "geometry unchanged",
    buildPortraitHairCards(curled),
    buildPortraitHairCards(shape),
  );
  const preserved: typeof legacy = {
    ...result,
    baseColorTexture: legacy.baseColorTexture,
    normalTexture: legacy.normalTexture,
  };
  TestValidator.equals("other finish settings unchanged", preserved, legacy);
  TestValidator.equals(
    "exact replay",
    createPortraitHairMaterial(finish, curled),
    result,
  );
  const zero = createPortraitHairMaterial(finish, {
    ...curled,
    fibreNormalScale: 0,
  });
  TestValidator.equals(
    "zero retains base normal",
    [zero.normalTexture, zero.normalScale],
    [finish.normalTexture, finish.normalScale],
  );
  TestValidator.equals(
    "zero still curls mask",
    zero.baseColorTexture,
    result.baseColorTexture,
  );
  TestValidator.equals("inputs preserved", { shape, finish }, before);
};
