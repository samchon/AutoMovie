import {
  type IPortraitEyebrowProfile,
  assertPortraitEyebrowProfile,
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "@automovie/human/components/eyebrows";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Fibre distribution can occupy a complete brow without moving its skin binding.
 * Optional fractions retain the basic construction and refuse unsupported spans.
 *
 * Scenarios:
 * 1. Omitted and explicit default root bands produce identical resident meshes.
 *    A wider root band increases vertical coverage over the same planar skin.
 * 2. Zero and full spans are admitted at their exact endpoints. Reversed,
 *    malformed, nonfinite and overflowing bands or spans refuse before allocation.
 * 3. Endpoint fades thin medial populations on both anatomical sides without
 *    resizing retained fibres; invalid fade arrays refuse before allocation.
 */
export const test_subject_brow_distribution = (): void => {
  const skin = {
    positions: [
      [-20, -20, 0],
      [20, -20, 0],
      [20, 20, 0],
      [-20, 20, 0],
      [-10, 4, 0],
      [10, 4, 0],
      [-10, 0, 0],
      [10, 0, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [0, 0],
  };
  const binding = { side: "left" as const, upper: [4, 5], lower: [6, 7] };
  const build = (profile: IPortraitEyebrowProfile) =>
    buildPortraitEyebrow(skin, binding, 12, profile);
  const plain = build(portraitEyebrowProfile);
  TestValidator.equals(
    "default band preserves geometry",
    build({ ...portraitEyebrowProfile, rootBand: [0.1, 0.22] }),
    plain,
  );
  const wide = build({
    ...portraitEyebrowProfile,
    rootBand: [0.02, 0.65],
    span: 0.3,
  });
  const height = (parts: typeof wide) => {
    const values = parts.flatMap((part) => {
      if (part.geometry.type !== "mesh")
        throw new Error("Brow must contain meshes.");
      return part.geometry.mesh.positions.filter((_v, i) => i % 3 === 1);
    });
    return Math.max(...values) - Math.min(...values);
  };
  TestValidator.predicate(
    "distribution fills more of the same brow",
    height(wide) > height(plain) + 0.001,
  );
  for (const patch of [
    { rootBand: [1, 1] as const, span: 0 },
    { rootBand: [0, 0] as const, span: 1 },
  ])
    build({ ...portraitEyebrowProfile, ...patch });
  const invalid: Partial<IPortraitEyebrowProfile>[] = [
    { rootBand: [] as unknown as [number, number] },
    { rootBand: [NaN, 0.2] },
    { rootBand: [-0.01, 0.2] },
    { rootBand: [0.3, 0.2] },
    { rootBand: [0.1, 0.8] },
    { rootBand: [0, 1], span: 0.01 },
    { span: NaN },
    { span: -0.01 },
    { span: 1 },
  ];
  for (const patch of invalid)
    TestValidator.predicate(
      "invalid distribution refuses",
      throwsError(
        () =>
          assertPortraitEyebrowProfile(
            { ...portraitEyebrowProfile, ...patch },
            1,
          ),
        "root band",
      ),
    );
  for (const endFade of [[], [NaN, 0], [0, -0.01], [0, 0.51]])
    TestValidator.predicate(
      "invalid end fade refuses",
      throwsError(
        () =>
          assertPortraitEyebrowProfile(
            {
              ...portraitEyebrowProfile,
              endFade: endFade as unknown as [number, number],
            },
            1,
          ),
        "endpoint fades",
      ),
    );
  const faded = build({ ...portraitEyebrowProfile, endFade: [0.5, 0] });
  const right = buildPortraitEyebrow(skin, { ...binding, side: "right" }, 12, {
    ...portraitEyebrowProfile,
    endFade: [0.5, 0],
  });
  TestValidator.predicate(
    "medial fade thins left endpoint",
    faded.length < plain.length &&
      !faded.some((part) => part.id === plain[0].id),
  );
  TestValidator.equals(
    "lateral left endpoint remains intact",
    faded.find((part) => part.id === plain[11].id),
    plain[11],
  );
  const rightPlain = buildPortraitEyebrow(
    skin,
    { ...binding, side: "right" },
    12,
    portraitEyebrowProfile,
  );
  TestValidator.equals(
    "lateral right endpoint remains intact",
    right[0],
    rightPlain[0],
  );
  TestValidator.predicate(
    "medial fade thins right endpoint",
    right.length < rightPlain.length &&
      !right.some((part) => part.id === rightPlain[11].id),
  );
};
