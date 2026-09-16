import type { IPortraitTongueShape } from "@automovie/human";

/** Small authored oral body with no source-image or anatomical population claim. */
export const portraitTongueFixture = (): IPortraitTongueShape => ({
  halfWidth: 18,
  length: 43,
  halfThickness: 5,
  dorsumRise: 3,
  grooveDepth: 0.65,
  grooveWidth: 2.5,
  drop: 2,
  recess: 12,
  material: "lips",
});
