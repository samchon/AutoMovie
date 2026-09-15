import { createPortraitHairTexture } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

/**
 * Curl phase and occupancy are independent from pigment modulation.
 * Scenarios:
 * 1. A complete curved pattern retains exact alpha when RGB modulation is zero.
 * 2. Explicit strength one and omission produce the same curled PNG bytes.
 */
export const test_subject_hair_shade_curl = (): void => {
  const curl = { amplitude: 0.2, cycles: 3, aspectRatio: 0.5 };
  const legacy = createPortraitHairTexture(3, 1, 0.8, curl);
  TestValidator.equals(
    "curled default exact",
    createPortraitHairTexture(3, 1, 0.8, curl, 1),
    legacy,
  );
  const a = PNG.sync.read(Buffer.from(legacy.slice(22), "base64")),
    b = PNG.sync.read(
      Buffer.from(
        createPortraitHairTexture(3, 1, 0.8, curl, 0).slice(22),
        "base64",
      ),
    );
  TestValidator.equals("curled dimensions", [b.width, b.height], [512, 512]);
  let exact = true;
  for (let at = 0; at < a.data.length; at += 4)
    exact &&=
      a.data[at + 3] === b.data[at + 3] &&
      b.data[at] === 255 &&
      b.data[at + 1] === 255 &&
      b.data[at + 2] === 255;
  TestValidator.predicate("unit RGB and identical curled alpha", exact);
};
