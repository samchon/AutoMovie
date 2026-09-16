import { createPortraitHairTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { nclose } from "../internal/predicates";

/**
 * Fibre pigment modulation cannot change the authored occupancy mask.
 * Scenarios:
 * 1. Omission and one preserve exact PNG bytes, including the legacy dimensions.
 * 2. Zero has unit RGB everywhere with identical alpha; one half interpolates
 *    encoded RGB towards white within one byte of the quantized input oracle.
 */
export const test_subject_hair_shade_texture = (): void => {
  const legacy = createPortraitHairTexture(1, 1, 1);
  TestValidator.equals(
    "default exact",
    createPortraitHairTexture(1, 1, 1, undefined, 1),
    legacy,
  );
  const decode = (uri: string) =>
    PNG.sync.read(Buffer.from(uri.slice(22), "base64"));
  const original = decode(legacy),
    zero = decode(createPortraitHairTexture(1, 1, 1, undefined, 0)),
    half = decode(createPortraitHairTexture(1, 1, 1, undefined, 0.5));
  TestValidator.equals("dimensions", [zero.width, zero.height], [128, 256]);
  let unit = true,
    alpha = true,
    interpolated = true,
    modulation = false;
  for (let at = 0; at < original.data.length; at += 4) {
    alpha &&=
      original.data[at + 3] === zero.data[at + 3] &&
      original.data[at + 3] === half.data[at + 3];
    for (let c = 0; c < 3; c++) {
      unit &&= zero.data[at + c] === 255;
      interpolated &&= nclose(
        half.data[at + c],
        (255 + original.data[at + c]) / 2,
        1,
      );
    }
    if (original.data[at + 3] > 0 && original.data[at] < 250) modulation = true;
  }
  TestValidator.predicate("mask has shaded fibres", modulation);
  TestValidator.predicate("unit pigment", unit);
  TestValidator.predicate("alpha untouched", alpha);
  TestValidator.predicate("independent half interpolation", interpolated);
};
