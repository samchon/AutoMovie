import {
  type IPortraitHairShape,
  assertPortraitHairFibreCurl,
  buildPortraitHairCards,
  createPortraitHairMaterial,
  createPortraitHairTexture,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * Invalid pattern values refuse even when there are no hair triangles.
 * Scenarios:
 * 1. Both inclusive endpoints of each scalar remain valid in an empty groom.
 * 2. Adjacent out-of-range values, NaN, infinity, missing members and untyped
 *    null/nonobjects refuse in shared admission, geometry and material paths.
 */
export const test_subject_hair_curl_refusals = (): void => {
  const base = { amplitude: 0.2, cycles: 3, aspectRatio: 0.5 };
  const shape: IPortraitHairShape = {
    material: "hair",
    cards: [],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 1,
    fibres: 1,
    coverage: 1,
  };
  const rows = [
    ["amplitude", 0, 0.5],
    ["cycles", 0, 16],
    ["aspectRatio", 0.01, 100],
  ] as const;
  for (const [key, lo, hi] of rows) {
    for (const value of [lo, hi]) {
      const fibreCurl = { ...base, [key]: value };
      assertPortraitHairFibreCurl(fibreCurl);
      TestValidator.equals(
        "inclusive geometry admission",
        buildPortraitHairCards({ ...shape, fibreCurl }),
        [],
      );
    }
    for (const value of [lo - 0.001, hi + 0.001, NaN, Infinity, undefined]) {
      const fibreCurl = { ...base, [key]: value } as typeof base;
      TestValidator.predicate(
        "invalid direct admission",
        throwsError(() => assertPortraitHairFibreCurl(fibreCurl)),
      );
      TestValidator.predicate(
        "empty geometry refuses",
        throwsError(() => buildPortraitHairCards({ ...shape, fibreCurl })),
      );
      TestValidator.predicate(
        "material refuses",
        throwsError(() =>
          createPortraitHairMaterial(createModel(null).materials[0], {
            ...shape,
            fibreCurl,
          }),
        ),
      );
    }
  }
  for (const bad of [null, 1])
    TestValidator.predicate(
      "untyped nonobject refuses",
      throwsError(() =>
        createPortraitHairTexture(1, 1, 1, bad as unknown as typeof base),
      ),
    );
};
