import { appendPortraitEyeMargins } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { nclose } from "../internal/predicates";

/**
 * The roll's longitudinal weights progress from medial to lateral on either eye.
 * A left/right selection changes anatomy, not the meaning of a detail array.
 *
 * Scenarios:
 * 1. Mirror a medial-low, lateral-high roll across a symmetric planar aperture.
 *    Only lower tissue depth differs and its sign follows the anatomical side.
 * 2. Upper rows and centreline samples remain identical on both eyes.
 */
export const test_subject_aegyo_handedness = (): void => {
  const portraitEyeShape = portraitEyeShapeFixture();
  const source = [
    [-4, 0, 0],
    [0, 2, 0],
    [4, 0, 0],
    [-2, -1.5, 0],
    [0, -2, 0],
    [2, -1.5, 0],
  ];
  const build = (name: "left" | "right") => {
    const cage = {
      positions: source.map((p) => [...p]),
      indices: [] as number[],
      groups: [] as number[],
    };
    appendPortraitEyeMargins(
      cage,
      source,
      {
        name,
        top: [0, 1, 2],
        bottom: [0, 3, 4, 5, 2],
        iris: 0,
        browTop: [],
        browBottom: [],
      },
      {
        ...portraitEyeShape,
        aegyoSal: {
          // Round-mm section dimensions belong to this synthetic aperture.
          offset: 0.5,
          height: 1,
          width: 6,
          reach: 6,
          projection: 1,
          weights: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1],
        },
      },
    );
    return cage.positions;
  };
  const left = build("left"),
    right = build("right");
  let positive = false,
    negative = false;
  for (let i = 0; i < left.length; i++) {
    TestValidator.equals(
      "shared planar section",
      left[i].slice(0, 2),
      right[i].slice(0, 2),
    );
    const delta = left[i][2] - right[i][2];
    if (nclose(delta, 0)) continue;
    TestValidator.predicate(
      "lower lateral fullness follows anatomy",
      left[i][1] < 0 && delta * left[i][0] > 0,
    );
    if (left[i][0] > 0) positive = true;
    else negative = true;
  }
  TestValidator.predicate("both lateral sides respond", positive && negative);
};
