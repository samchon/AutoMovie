import {
  buildPortraitHairCards,
  createPortraitHairMaterial,
  createPortraitHairTexture,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * Invalid pigment modulation refuses even when no geometry would be emitted.
 * Scenarios:
 * 1. Adjacent negative/over-one values and each nonfinite number refuse in the
 *    texture, material and empty-groom geometry consumers.
 * 2. Both exact endpoints admit an empty groom without adding parts.
 */
export const test_subject_hair_shade_refusals = (): void => {
  const { shape, finish } = portraitHairShadeFixture();
  for (const value of [
    -Number.MIN_VALUE,
    1 + Number.EPSILON,
    NaN,
    Infinity,
    -Infinity,
  ]) {
    const invalid = { ...shape, cards: [], fibreShadeStrength: value };
    TestValidator.predicate(
      "texture refuses",
      throwsError(() => createPortraitHairTexture(1, 1, 1, undefined, value)),
    );
    TestValidator.predicate(
      "material refuses",
      throwsError(() => createPortraitHairMaterial(finish, invalid)),
    );
    TestValidator.predicate(
      "empty groom refuses",
      throwsError(() => buildPortraitHairCards(invalid)),
    );
  }
  for (const fibreShadeStrength of [0, 1])
    TestValidator.equals(
      "empty endpoint",
      buildPortraitHairCards({ ...shape, cards: [], fibreShadeStrength }),
      [],
    );
};
