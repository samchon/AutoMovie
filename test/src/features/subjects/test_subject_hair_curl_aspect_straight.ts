import { createPortraitHairNormalTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

/**
 * A stationary painted wave has no lengthwise slope to rescale.
 * Scenarios:
 * 1. With zero cycles, doubling nominal width/length preserves exact normals.
 */
export const test_subject_hair_curl_aspect_straight = (): void => {
  const shape = { amplitude: 0.2, cycles: 0, aspectRatio: 0.5 };
  TestValidator.equals(
    "stationary wave has no slope",
    createPortraitHairNormalTexture(1, 1, 1, shape),
    createPortraitHairNormalTexture(1, 1, 1, { ...shape, aspectRatio: 1 }),
  );
};
