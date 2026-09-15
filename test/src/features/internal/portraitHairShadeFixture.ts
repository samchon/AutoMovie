import type { IPortraitHairShape } from "@automovie/human";

import { createModel } from "./fixtures";

/** A single straight strip and its independent resident base finish. */
export const portraitHairShadeFixture = () => {
  const finish = createModel(null).materials[0];
  const shape: IPortraitHairShape = {
    material: finish.id,
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
    seed: 1,
    fibres: 1,
    coverage: 1,
  };
  return { shape, finish };
};
