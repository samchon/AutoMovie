import {
  createPortraitHairNormalTexture,
  createPortraitHairTexture,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Fibre normals describe the same occupied mask with no extra mesh population.
 * Scenarios:
 * 1. A single seed-one fibre has zero phase. At t=1/5 its centre is
 *    0.5+0.2*sin(1) and its full-coverage radius is 1/2; sampled RGB agrees
 *    with an independent circular cross-section calculation.
 * 2. Empty roots and tips stay flat; occupied samples span both transverse
 *    directions with unit-length normals to eight-bit quantization accuracy.
 * 3. RGB PNG decodes, equal parameters replay and a different seed changes it.
 *    Invalid inputs refuse through the shared texture admission.
 */
export const test_subject_hair_normal_texture = (): void => {
  const uri = createPortraitHairNormalTexture(1, 1, 1);
  const bytes = Buffer.from(uri.slice(22), "base64");
  const normal = PNG.sync.read(bytes);
  const mask = PNG.sync.read(
    Buffer.from(createPortraitHairTexture(1, 1, 1).slice(22), "base64"),
  );
  TestValidator.equals("RGB, not unused alpha", bytes[25], 2);
  TestValidator.equals(
    "same raster",
    [normal.width, normal.height],
    [128, 256],
  );
  for (const x of [55, 85, 115]) {
    const at = (51 * 128 + x) * 4;
    TestValidator.equals("oracle cell is opaque", mask.data[at + 3], 255);
    const transverse = 2 * ((x + 0.5) / 128 - (0.5 + 0.2 * Math.sin(1)));
    const expected = [transverse, 0, Math.sqrt(1 - transverse ** 2)];
    TestValidator.predicate(
      "circular fibre normal",
      expected.every((v, i) =>
        nclose(normal.data[at + i] / 127.5 - 1, v, 1 / 255),
      ),
    );
  }
  let left = 0,
    right = 0;
  for (let at = 0; at < normal.data.length; at += 4) {
    if (mask.data[at + 3] === 0) {
      // Quantized alpha may reach zero before its analytic fade does. The
      // first and last rows are exactly empty, independent of that rounding.
      if (at < 128 * 4 || at >= 255 * 128 * 4)
        TestValidator.equals(
          "flat empty row",
          Array.from(normal.data.slice(at, at + 3)),
          [128, 128, 255],
        );
    } else {
      const values = Array.from(
        normal.data.slice(at, at + 3),
        (v) => v / 127.5 - 1,
      );
      TestValidator.predicate(
        "positive unit hemisphere",
        values[2] > 0 && nclose(Math.hypot(...values), 1, 0.007),
      );
      if (values[0] < -0.1) left++;
      if (values[0] > 0.1) right++;
    }
  }
  TestValidator.predicate("both sides occupied", left > 0 && right > 0);
  TestValidator.equals(
    "exact replay",
    createPortraitHairNormalTexture(1, 1, 1),
    uri,
  );
  TestValidator.predicate(
    "seed is effective",
    createPortraitHairNormalTexture(2, 1, 1) !== uri,
  );
  TestValidator.predicate(
    "invalid shared parameters",
    throwsError(() => createPortraitHairNormalTexture(0, 0, 1)),
  );
};
