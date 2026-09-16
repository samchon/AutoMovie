import { createPortraitMaterials } from "@automovie/human";

import { humanFaceFixture } from "./humanFaceFixture";

/** One inherited groom and a custom resident base for appearance-owner logic. */
export const humanHairAppearanceFixture = () => {
  const face = humanFaceFixture("coloured-groom");
  const palette = createPortraitMaterials();
  const hair = palette.find((m) => m.id === "hair")!;
  face.appearance = [
    ...palette,
    { ...structuredClone(hair), id: "copper-groom", alphaCutoff: 0.25 },
  ];
  face.basis.recipe.hair = {
    material: "copper-groom",
    cards: [
      {
        guide: [
          [0, 120, 0],
          [0, 110, -10],
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
    seed: 0,
    fibres: 2,
    coverage: 0.7,
  };
  return face;
};
