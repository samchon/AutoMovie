import { TestValidator } from "@nestia/e2e";

import { portraitMouthShape } from "../../subjects/generated-korean-girl-01/configuration";
import { buildPortraitMouth } from "../../subjects/generated-korean-girl-01/mouth";

/**
 * Crown width and interdental clearance are distances along the dental row,
 * independent of the row's orientation in the head's horizontal plane.
 *
 * Scenarios:
 * 1. Two unequal crowns on a 45-degree straight guide retain physical widths
 *    of 4 and 6 mm, with a 0.2 mm clearance rather than X-projected spacing.
 * 2. Zero clearance makes adjacent widths meet; changing clearance translates
 *    the centres without shrinking the enamel geometry.
 */
export const test_subject_dental_spacing = (): void => {
  const socket = { outer: [], upper: [0, 1, 2], lower: [0, 3, 2], lipSeed: 0 };
  const source = [
    [-20, 0, -20],
    [0, 0, 0],
    [20, 0, 20],
    [0, -3, 0],
  ];
  for (const gap of [0, 0.2]) {
    const parts = buildPortraitMouth(source, socket, {
      ...portraitMouthShape,
      dentalOffset: 0,
      dentalRecess: 0,
      toothGap: gap,
      crowns: [
        { width: 4, height: 6 },
        { width: 6, height: 6 },
      ],
    });
    const intervals = parts.slice(1).map((part) => {
      if (part.geometry.type !== "mesh")
        throw new Error("Expected a crown mesh.");
      const values: number[] = [];
      const positions = part.geometry.mesh.positions;
      for (let i = 0; i < positions.length; i += 3)
        values.push((positions[i] + positions[i + 2]) * Math.SQRT1_2 * 1000);
      return [Math.min(...values), Math.max(...values)];
    });
    for (let i = 0; i < intervals.length; i++)
      TestValidator.predicate(
        "physical width survives guide rotation and gap edits",
        Math.abs(intervals[i][1] - intervals[i][0] - [4, 6][i]) < 1e-6,
      );
    TestValidator.predicate(
      "clearance is measured along the row",
      Math.abs(intervals[1][0] - intervals[0][1] - gap) < 1e-6,
    );
  }
};
