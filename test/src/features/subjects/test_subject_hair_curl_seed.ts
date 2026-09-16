import { createPortraitHairTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

/**
 * Seeded curved fibres share a raster without sharing one phase.
 * Scenarios:
 * 1. Two overlapping painted fibres replay exactly for a fixed seed.
 * 2. Changing only the seed changes occupied pixels, not just their colour;
 *    independent waves keep both occupied and empty samples.
 */
export const test_subject_hair_curl_seed = (): void => {
  const curl = { amplitude: 0.25, cycles: 4.8, aspectRatio: 0.5 };
  const first = createPortraitHairTexture(1, 2, 0.8, curl);
  TestValidator.equals(
    "two-fibre replay",
    createPortraitHairTexture(1, 2, 0.8, curl),
    first,
  );
  const decode = (uri: string) =>
    PNG.sync.read(Buffer.from(uri.slice(22), "base64"));
  const a = decode(first),
    b = decode(createPortraitHairTexture(2, 2, 0.8, curl));
  let changed = 0,
    occupied = 0,
    empty = 0;
  for (let i = 3; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i]) changed++;
    if (a.data[i] > 127) occupied++;
    else empty++;
  }
  TestValidator.predicate("seed changes coverage", changed > 1000);
  TestValidator.predicate(
    "both occupancy states",
    occupied > 1000 && empty > 1000,
  );
};
