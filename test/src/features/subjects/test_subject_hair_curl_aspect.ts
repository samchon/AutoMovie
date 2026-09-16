import { createPortraitHairNormalTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

/**
 * Nominal aspect changes the shading orientation of a curved fibre.
 * Scenarios:
 * 1. Doubling width/length changes a curved fibre's normal map.
 */
export const test_subject_hair_curl_aspect = (): void => {
  const a = { amplitude: 0.2, cycles: 2, aspectRatio: 0.5 },
    b = { ...a, aspectRatio: 1 };
  TestValidator.predicate(
    "aspect changes normal",
    createPortraitHairNormalTexture(1, 1, 1, a) !==
      createPortraitHairNormalTexture(1, 1, 1, b),
  );
};
