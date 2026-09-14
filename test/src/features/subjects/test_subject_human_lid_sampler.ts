import { createPortraitLidSectionSampler } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

/**
 * A root-package consumer can sample a named anatomical tissue section.
 *
 * Scenarios:
 * 1. Equal midpoint weights interpolate authored attachment and margin values.
 * 2. Mutating a returned section cannot change the sampler's owned witnesses.
 */
export const test_subject_human_lid_sampler = (): void => {
  const sample = createPortraitLidSectionSampler(
    [
      {
        at: 0,
        section: { attachment: 4, margin: { offset: 1, projection: 0 } },
      },
      {
        at: 1,
        section: { attachment: 8, margin: { offset: 3, projection: 2 } },
      },
    ],
    ["margin"],
    "Upper-lid",
  );
  const middle = sample(0.5);
  TestValidator.equals("midpoint attachment", middle.attachment, 6);
  TestValidator.equals("midpoint offset", middle.margin.offset, 2);
  TestValidator.equals("midpoint projection", middle.margin.projection, 1);
  middle.margin.offset = 99;
  TestValidator.equals("owned witness survives", sample(0).margin.offset, 1);
};
