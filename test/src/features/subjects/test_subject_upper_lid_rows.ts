import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
} from "@automovie/human/components/eyes";
import type { IPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { nclose } from "../internal/predicates";

/**
 * Upper section detail reaches shared rings while the wet opening, canthi and
 * lower lid keep their own geometry. Hand-authored planar anatomy isolates it.
 *
 * Scenarios:
 * 1. Medial-low/lateral-high relief switches head-X sides for the paired eyes.
 *    Every wet-rim point and every lower-ring point remains exactly unchanged.
 * 2. At upper centre the sine weight is one: tarsal offset 1 and relief 2 give
 *    XYZ (0,3,2). Basic fold depth/width/volume cannot double that detailed row.
 * 3. A performed inner aperture moves while its identity guide and existing
 *    outer rim remain fixed, testing the detailed contact-to-host bridge.
 */
export const test_subject_upper_lid_rows = (): void => {
  const portraitEyeShape = portraitEyeShapeFixture();
  const source = [
    [-4, 0, 0],
    [-2, 1.5, 0],
    [0, 2, 0],
    [2, 1.5, 0],
    [4, 0, 0],
    [0, -2, 0],
  ];
  const profile: IPortraitUpperLidProfile = {
    sections: [0, 1].map((at) => ({
      at,
      section: {
        margin: { offset: 0.15, projection: 0.1 },
        tarsal: { offset: 1, projection: 1 + 2 * at },
        creaseInner: { offset: 2, projection: -0.1 },
        creaseOuter: { offset: 2.5, projection: -0.1 },
        hood: { offset: 3, projection: 0.3 },
        preseptal: { offset: 4, projection: 0 },
        attachment: 5,
      },
    })),
  };
  const base = {
    ...portraitEyeShape,
    aegyoSal: undefined,
    lowerLidProfile: undefined,
    upperLidProfile: undefined,
  };
  const build = (
    name: "left" | "right",
    shape: IPortraitEyeShape,
    guide?: number[][],
  ) => {
    const cage = {
      positions: source.map((p) => [...p]),
      indices: [] as number[],
      groups: [] as number[],
    };
    const aperture = source.map((p) => [...p]);
    if (guide) aperture[2][1] = 1;
    const margins = appendPortraitEyeMargins(
      cage,
      aperture,
      {
        name,
        top: [0, 1, 2, 3, 4],
        bottom: [0, 5, 4],
        iris: 0,
        browTop: [],
        browBottom: [],
      },
      shape,
      0,
      undefined,
      guide,
    );
    return { cage, margins };
  };
  const basic = build("left", base),
    left = build("left", { ...base, upperLidProfile: profile }),
    right = build("right", { ...base, upperLidProfile: profile });
  for (const id of [0, 1, 2, 3, 4, 5])
    TestValidator.equals(
      "wet opening stays fixed",
      left.cage.positions[left.margins.get(id)!],
      basic.cage.positions[basic.margins.get(id)!],
    );
  let positive = false,
    negative = false;
  for (let i = source.length; i < left.cage.positions.length; i++) {
    const p = left.cage.positions[i],
      q = right.cage.positions[i],
      b = basic.cage.positions[i];
    if (b[1] <= 0) TestValidator.equals("lower tissue and canthi fixed", p, b);
    TestValidator.equals(
      "side only changes longitudinal relief",
      p.slice(0, 2),
      q.slice(0, 2),
    );
    const delta = p[2] - q[2];
    if (!nclose(delta, 0)) {
      TestValidator.predicate("anatomical lateral side", delta * p[0] > 0);
      if (p[0] > 0) positive = true;
      else negative = true;
    }
  }
  TestValidator.predicate(
    "both handedness branches differ",
    positive && negative,
  );
  // Six points per ring; tarsal is the fifth appended ring and centre is fifth
  // in the CCW bottom + reversed-top sequence: [0,5,4,3,2,1].
  const centre = 6 + 4 * 6 + 4;
  TestValidator.predicate(
    "independent central tarsal oracle",
    left.cage.positions[centre].every((v, i) => nclose(v, [0, 3, 2][i])),
  );
  const altered = build("left", {
    ...base,
    foldWidth: 20,
    foldDepth: 8,
    upperLidVolume: 7,
    upperLidProfile: profile,
  });
  TestValidator.equals(
    "basic upper relief not added twice",
    altered.cage.positions[centre],
    left.cage.positions[centre],
  );
  const posed = build("left", { ...base, upperLidProfile: profile }, source);
  TestValidator.equals(
    "identity outer seam fixed",
    posed.cage.positions.slice(0, 6),
    left.cage.positions.slice(0, 6),
  );
  TestValidator.equals(
    "performed wet point moves",
    posed.cage.positions[posed.margins.get(2)!],
    [0, 1, base.lidThickness],
  );
  TestValidator.predicate(
    "guide movement fades across section",
    nclose(posed.cage.positions[centre][1], 3 - (1 - 0.104)),
  );
};
