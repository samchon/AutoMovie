import { createPortraitHairTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

/**
 * Nominal aspect controls shading orientation without repainting occupancy.
 * Scenarios:
 * 1. Doubling width/length preserves a curved fibre's complete colour mask.
 */
export const test_subject_hair_curl_aspect_mask = (): void => {
  const shape = { amplitude: 0.2, cycles: 2, aspectRatio: 0.5 };
  TestValidator.equals(
    "aspect preserves mask",
    createPortraitHairTexture(1, 1, 1, shape),
    createPortraitHairTexture(1, 1, 1, { ...shape, aspectRatio: 1 }),
  );
};
