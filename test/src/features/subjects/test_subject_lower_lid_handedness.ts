import { TestValidator } from "@nestia/e2e";

import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import { appendPortraitEyeMargins } from "../../subjects/generated-korean-girl-01/eyes";
import type { IPortraitLowerLidProfile } from "../../subjects/generated-korean-girl-01/lowerLidSection";
import { nclose } from "../internal/predicates";

/**
 * Anatomical handedness controls longitudinal detail on a symmetric aperture.
 * The stronger lateral pretarsal crest must switch head-X sides with the eye.
 *
 * Scenarios:
 * 1. A symmetric planar aperture and a medial-low/lateral-high profile produce
 *    identical XY but higher depth at positive X for the left eye, negative X
 *    for the right eye. Both sides must exhibit the difference.
 * 2. Upper controls and all middle-X samples agree, rejecting a global depth
 *    translation masquerading as independently oriented tissue detail.
 */
export const test_subject_lower_lid_handedness = (): void => {
  const source = [
    [-4, 0, 0],
    [0, 2, 0],
    [4, 0, 0],
    [-2, -1.5, 0],
    [0, -2, 0],
    [2, -1.5, 0],
  ];
  const profile: IPortraitLowerLidProfile = {
    sections: [0, 1].map((at) => ({
      at,
      section: {
        margin: { offset: 0.2, projection: 0.2 },
        pretarsalCrest: { offset: 1.5, projection: at },
        pretarsalLower: { offset: 2, projection: 0 },
        subtarsalInner: { offset: 2.5, projection: 0 },
        subtarsalOuter: { offset: 3, projection: 0 },
        preseptal: { offset: 4, projection: 0 },
        attachment: 5,
      },
    })),
  };
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
      { ...portraitEyeShape, aegyoSal: undefined, lowerLidProfile: profile },
    );
    return cage.positions;
  };
  const left = build("left"),
    right = build("right");
  let positive = false,
    negative = false;
  for (let i = 0; i < left.length; i++) {
    TestValidator.equals(
      "detail has identical planar placement",
      left[i].slice(0, 2),
      right[i].slice(0, 2),
    );
    const delta = left[i][2] - right[i][2];
    if (nclose(delta, 0)) continue;
    TestValidator.predicate("only lower tissue differs", left[i][1] < 0);
    TestValidator.predicate(
      "lateral crest follows side",
      delta * left[i][0] > 0,
    );
    if (left[i][0] > 0) positive = true;
    else negative = true;
  }
  TestValidator.predicate(
    "both sides exercise orientation",
    positive && negative,
  );
};
