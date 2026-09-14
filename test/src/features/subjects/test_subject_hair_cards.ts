import {
  type IPortraitHairShape,
  buildPortraitHairCards,
} from "@automovie/human/components/hairCards";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * One surface lock carries many painted fibres without multiplying geometry.
 * Scenarios:
 * 1. A straight 10 mm lock gives six vertices and four triangles at two segments,
 *    metric positions, normalized UVs and a half-width tip. Source is untouched.
 * 2. More painted fibres preserve mesh bytes; an empty population emits nothing.
 * 3. Bad widths, populations, samples, seed, coverage, frames and collapsed guides refuse.
 * 4. Individually overflowing triangle areas and overflowing shared normal sums
 *    refuse even when all authored stations are finite.
 */
export const test_subject_hair_cards = (): void => {
  const shape: IPortraitHairShape = {
    material: "hair",
    cards: [
      {
        guide: [
          [0, 0, 0],
          [0, 10, 0],
        ],
        across: [
          [1, 0, 0],
          [1, 0, 0],
        ],
        width: 2,
      },
    ],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 3,
    fibres: 8,
    coverage: 0.7,
  };
  const before = JSON.stringify(shape),
    parts = buildPortraitHairCards(shape),
    mesh = parts[0].geometry;
  if (mesh.type !== "mesh") throw new Error("Expected resident card mesh");
  TestValidator.equals("one strip", parts.length, 1);
  TestValidator.equals("six vertices", mesh.mesh.positions.length, 18);
  TestValidator.equals("four triangles", mesh.mesh.indices!.length, 12);
  TestValidator.predicate(
    "metric width and tapered tip",
    Math.abs(mesh.mesh.positions[0] + 0.001) < 1e-12 &&
      Math.abs(mesh.mesh.positions[12] + 0.0005) < 1e-12 &&
      Math.abs(mesh.mesh.positions[13] - 0.01) < 1e-12,
  );
  TestValidator.equals(
    "normalized root-to-tip UVs",
    mesh.mesh.uvs,
    [0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1],
  );
  TestValidator.equals(
    "painted density is not geometry",
    buildPortraitHairCards({ ...shape, fibres: 32 }),
    parts,
  );
  TestValidator.equals("caller retained", JSON.stringify(shape), before);
  TestValidator.equals(
    "frame magnitude is not a shape parameter",
    buildPortraitHairCards({
      ...shape,
      cards: [
        {
          ...shape.cards[0],
          across: [
            [1e-300, 0, 0],
            [1e-300, 0, 0],
          ],
        },
      ],
    }),
    parts,
  );
  TestValidator.equals(
    "empty hairstyle",
    buildPortraitHairCards({ ...shape, cards: [] }),
    [],
  );
  const maximum = buildPortraitHairCards({
    ...shape,
    cards: Array.from({ length: 1024 }, () => shape.cards[0]),
    widthScale: 4,
    tipWidth: 1,
    seed: 0xffffffff,
    fibres: 32,
    coverage: 1,
  })[0].geometry;
  if (maximum.type !== "mesh") throw new Error("Expected resident card mesh");
  TestValidator.equals(
    "inclusive card population",
    maximum.mesh.indices!.length,
    1024 * 2 * 6,
  );
  TestValidator.equals(
    "inclusive sampling and guide limits",
    buildPortraitHairCards({
      ...shape,
      cards: [
        {
          guide: Array.from({ length: 32 }, (_, i) => [0, i, 0] as const),
          across: Array.from({ length: 32 }, () => [1, 0, 0] as const),
          width: 40,
        },
      ],
      segments: 64,
      widthScale: 0.1,
      tipWidth: 0.05,
      seed: 0,
      fibres: 1,
      coverage: 0.1,
    }).length,
    1,
  );
  for (const change of [
    { material: "" },
    { cards: new Array(1025).fill(shape.cards[0]) },
    { segments: 1 },
    { segments: 65 },
    { segments: 2.5 },
    { widthScale: NaN },
    { widthScale: 0.09 },
    { widthScale: 4.1 },
    { tipWidth: 0 },
    { tipWidth: 1.1 },
    { tipWidth: Infinity },
    { seed: -1 },
    { seed: 2 ** 32 },
    { seed: 0.5 },
    { fibres: 0 },
    { fibres: 33 },
    { fibres: 1.5 },
    { coverage: 0.09 },
    { coverage: 1.1 },
    { coverage: NaN },
  ])
    TestValidator.predicate(
      "invalid shape",
      throwsError(() => buildPortraitHairCards({ ...shape, ...change })),
    );
  const longCard = (length: number): IPortraitHairShape => ({
    ...shape,
    widthScale: 4,
    tipWidth: 1,
    cards: [
      {
        ...shape.cards[0],
        width: 40,
        guide: [
          [0, 0, 0],
          [0, length, 0],
        ],
      },
    ],
  });
  const finiteLongCard = buildPortraitHairCards(longCard(1e305))[0].geometry;
  TestValidator.predicate(
    "representable derived areas are admitted",
    finiteLongCard.type === "mesh" &&
      finiteLongCard.mesh.normals!.every(Number.isFinite),
  );
  for (const length of [1e306, 1e307])
    TestValidator.predicate(
      "finite stations cannot admit unrepresentable derived geometry",
      throwsError(() => buildPortraitHairCards(longCard(length))),
    );
  for (const change of [
    { guide: [[0, 0, 0]] },
    { guide: new Array(33).fill([0, 0, 0]) },
    { across: [] },
    { width: 0 },
    { width: 41 },
    { width: NaN },
    {
      across: [
        [1e308, 0, 0],
        [1e308, 0, 0],
      ],
    },
    {
      guide: [
        [NaN, 0, 0],
        [0, 1, 0],
      ],
    },
    {
      guide: [
        [0, 0],
        [0, 1, 0],
      ],
    },
    {
      across: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    },
    {
      across: [
        [1, 0, 0],
        [-1, 0, 0],
      ],
    },
    {
      guide: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    },
    {
      across: [
        [0, 1, 0],
        [0, 1, 0],
      ],
    },
  ])
    TestValidator.predicate(
      "invalid card",
      throwsError(() =>
        buildPortraitHairCards({
          ...shape,
          cards: [
            { ...shape.cards[0], ...change } as (typeof shape.cards)[number],
          ],
        }),
      ),
    );
};
