import {
  buildPortraitHairCards,
  createPortraitHairMaterial,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * The actual material consumer forwards shade without changing relief or mesh.
 * Scenarios:
 * 1. Zero changes only the owned base-colour PNG; generated normals, cutoff and
 *    the resident finish are preserved, as are all guide-strip outputs.
 * 2. Explicit one is exactly the legacy finish and inputs remain unchanged.
 */
export const test_subject_hair_shade_material = (): void => {
  const { shape, finish } = portraitHairShadeFixture();
  shape.fibreNormalScale = 0.5;
  const before = structuredClone({ shape, finish }),
    original = createPortraitHairMaterial(finish, shape);
  const zeroShape = { ...shape, fibreShadeStrength: 0 },
    zero = createPortraitHairMaterial(finish, zeroShape);
  TestValidator.predicate(
    "owned pigment changes",
    zero.baseColorTexture !== original.baseColorTexture,
  );
  TestValidator.equals(
    "all other material values",
    { ...zero, baseColorTexture: original.baseColorTexture },
    original,
  );
  TestValidator.equals(
    "guide geometry unchanged",
    buildPortraitHairCards(zeroShape),
    buildPortraitHairCards(shape),
  );
  TestValidator.equals(
    "legacy finish exact",
    createPortraitHairMaterial(finish, { ...shape, fibreShadeStrength: 1 }),
    original,
  );
  TestValidator.equals("inputs retained", { shape, finish }, before);
};
