import { createPortraitHairTexture } from "@automovie/human/components/hairTexture";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { throwsError } from "../internal/predicates";

/**
 * The mathematical fibre image is a portable PNG, not renderer-only pixels.
 * Scenarios:
 * 1. An independent PNG decoder accepts all chunks and CRCs, sees the declared
 *    raster, transparent roots/tips and both occupied and empty fibre samples.
 * 2. Equal seeds replay exactly and changed seed/coverage change actual pixels.
 * 3. Limits admit; adjacent, fractional and nonfinite inputs refuse.
 */
export const test_subject_hair_texture = (): void => {
  const uri = createPortraitHairTexture(4, 8, 0.7);
  const raster = PNG.sync.read(Buffer.from(uri.slice(22), "base64"));
  TestValidator.equals(
    "raster dimensions",
    [raster.width, raster.height],
    [128, 256],
  );
  const alpha = Array.from(raster.data).filter((_v, i) => i % 4 === 3);
  TestValidator.predicate(
    "transparent root and tip",
    alpha.slice(0, 128).every((v) => v === 0) &&
      alpha.slice(-128).every((v) => v === 0),
  );
  TestValidator.predicate(
    "fibres and gaps",
    alpha.some((v) => v === 255) &&
      alpha.some((v) => v === 0) &&
      alpha.some((v) => v > 0 && v < 255),
  );
  TestValidator.equals("replay", createPortraitHairTexture(4, 8, 0.7), uri);
  TestValidator.predicate(
    "seed changes paint",
    createPortraitHairTexture(5, 8, 0.7) !== uri,
  );
  TestValidator.predicate(
    "coverage changes paint",
    createPortraitHairTexture(4, 8, 0.8) !== uri,
  );
  for (const tuple of [
    [0, 1, 0.1],
    [0xffffffff, 32, 1],
  ])
    TestValidator.predicate(
      "inclusive limits",
      createPortraitHairTexture(
        ...(tuple as [number, number, number]),
      ).startsWith("data:image/png;base64,"),
    );
  for (const tuple of [
    [-1, 8, 0.7],
    [2 ** 32, 8, 0.7],
    [0.5, 8, 0.7],
    [0, 0, 0.7],
    [0, 33, 0.7],
    [0, 1.5, 0.7],
    [0, 8, 0.09],
    [0, 8, 1.1],
    [0, 8, NaN],
  ])
    TestValidator.predicate(
      "invalid texture parameters",
      throwsError(() =>
        createPortraitHairTexture(...(tuple as [number, number, number])),
      ),
    );
};
