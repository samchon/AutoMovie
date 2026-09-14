import {
  type IPortraitEyebrowProfile,
  assertPortraitEyebrowProfile,
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "@automovie/human/components/eyebrows";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Seeded endpoint density thins a brow independently of root height. Omitted
 * seeds retain the original population for existing numerical documents.
 *
 * Scenarios:
 * 1. A four-millimetre planar brow with a full root band and 512 candidates has
 *    roots in every one-millimetre band near both faded ends, on either side.
 * 2. Fading removes a nonempty proper subset. Each retained strand is exactly
 *    the same mesh as its unfaded counterpart; thinning changes no dimensions.
 * 3. Seed zero replays exactly and a different seed selects another population;
 *    the maximum unsigned seed is admitted and adjacent invalid seeds refuse.
 */
export const test_subject_brow_density_coverage = (): void => {
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
  const shape: IPortraitEyebrowProfile = {
    ...portraitEyebrowProfile,
    representation: "ribbon",
    segments: 1,
    radiusStep: 0,
    rootBand: [0, 1],
    span: 0,
    outwardBend: 1,
    densitySeed: 0,
  };
  for (const side of ["left", "right"] as const) {
    const binding = { side, upper: [4, 5], lower: [6, 7] };
    const plain = buildPortraitEyebrow(skin, binding, 512, shape);
    const faded = buildPortraitEyebrow(skin, binding, 512, {
      ...shape,
      endFade: [0.5, 0.5],
    });
    TestValidator.equals(
      "same seed replays",
      buildPortraitEyebrow(skin, binding, 512, {
        ...shape,
        endFade: [0.5, 0.5],
      }),
      faded,
    );
    const alternate = buildPortraitEyebrow(skin, binding, 512, {
      ...shape,
      densitySeed: 0xffffffff,
      endFade: [0.5, 0.5],
    });
    TestValidator.predicate(
      "different seed selects another population",
      JSON.stringify(alternate.map((p) => p.id)) !==
        JSON.stringify(faded.map((p) => p.id)),
    );
    TestValidator.equals(
      "without fades the seed changes no geometry",
      buildPortraitEyebrow(skin, binding, 512, {
        ...shape,
        densitySeed: undefined,
      }),
      plain,
    );
    TestValidator.predicate(
      "fading removes a proper subset",
      faded.length > 0 && faded.length < plain.length,
    );
    const original = new Map(plain.map((part) => [part.id, part]));
    const medial = [0, 0, 0, 0],
      lateral = [0, 0, 0, 0];
    for (const part of faded) {
      TestValidator.equals(
        "retained geometry is unchanged",
        part,
        original.get(part.id),
      );
      if (part.geometry.type !== "mesh")
        throw new Error("Brow fibres need mesh geometry.");
      const p = part.geometry.mesh.positions;
      // Opposite root-row corners recover the authored centre in millimetres.
      const x = (p[0] + p[3]) * 500,
        y = (p[1] + p[4]) * 500;
      const progress = side === "left" ? (x + 10) / 20 : (10 - x) / 20;
      const bin = Math.min(3, Math.floor(y));
      if (progress < 0.25) medial[bin]++;
      if (progress > 0.75) lateral[bin]++;
    }
    TestValidator.predicate(
      "medial fade retains every root-height band",
      medial.every((count) => count > 0),
    );
    TestValidator.predicate(
      "lateral fade retains every root-height band",
      lateral.every((count) => count > 0),
    );
  }
  for (const densitySeed of [-1, 0x100000000, 0.5, NaN, Infinity])
    TestValidator.predicate(
      "invalid density seed refuses",
      throwsError(
        () => assertPortraitEyebrowProfile({ ...shape, densitySeed }, 1),
        "density seed",
      ),
    );
};
