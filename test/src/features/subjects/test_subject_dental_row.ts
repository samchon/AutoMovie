import { TestValidator } from "@nestia/e2e";

import {
  attachPortraitDentalRow,
  buildPortraitDentalRow,
} from "../../subjects/generated-korean-girl-01/dentalRow";
import { portraitPoint as p } from "../../subjects/geometry";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A shared arch and one rigid frame must preserve the dental group independently
 * of its mouth placement. The oracle turns the complete row by 90 degrees,
 * translates it and checks every position/normal; it does not copy the builder's
 * curve sampler. Crown-local dimensional/closedness tests remain separate.
 * Scenarios:
 * 1. Unequal crowns share one gingival plane and remain finite resident geometry.
 * 2. Identity and translated/rotated attachment preserve the whole row and input.
 * 3. Invalid arch, frame and buffer inputs refuse before returning bad geometry.
 */
export const test_subject_dental_row = (): void => {
  const crown = {
    width: 8,
    height: 10,
    depth: 1.5,
    cervicalWidth: 0.8,
    edgeRise: 0.3,
  };
  const shape = {
    halfWidth: 24,
    depth: 18,
    gap: 0.1,
    crowns: [crown, { ...crown, width: 6, height: 9 }],
  };
  const row = buildPortraitDentalRow(shape),
    saved = structuredClone(row);
  TestValidator.predicate(
    "shared gingival plane",
    nclose(Math.max(...row.positions.filter((_v, i) => i % 3 === 1)), 0),
  );
  const frame = {
    rightCorner: p(-1, 0, 0),
    leftCorner: p(1, 0, 0),
    upperLipMiddle: p(0, 0, 0),
    up: p(0, 1, 0),
    lift: 0,
    recess: 0,
  };
  TestValidator.equals(
    "identity frame",
    attachPortraitDentalRow(row, frame),
    row,
  );
  const moved = attachPortraitDentalRow(row, {
    ...frame,
    rightCorner: p(0, -1, 0),
    leftCorner: p(0, 1, 0),
    up: p(-1, 0, 0),
    upperLipMiddle: p(10, 20, 30),
    lift: 2,
    recess: 3,
  });
  let correct = true;
  for (let i = 0; i < row.positions.length; i += 3) {
    const expected = [
        8 - row.positions[i + 1],
        20 + row.positions[i],
        27 + row.positions[i + 2],
      ],
      normals = [-row.normals![i + 1], row.normals![i], row.normals![i + 2]];
    for (let a = 0; a < 3; a++)
      correct &&=
        nclose(moved.positions[i + a], expected[a]) &&
        nclose(moved.normals![i + a], normals[a]);
  }
  TestValidator.equals("one rigid transform for all crowns", correct, true);
  TestValidator.equals("mesh ownership", row, saved);
  TestValidator.equals("profile ownership", shape.crowns[0].width, 8);
  for (const patch of [
    { halfWidth: 0 },
    { depth: NaN },
    { gap: -1 },
    { crowns: [] },
  ])
    TestValidator.predicate(
      "invalid row refuses",
      throwsError(
        () => buildPortraitDentalRow({ ...shape, ...patch }),
        "dental row",
      ),
    );
  for (const patch of [
    { leftCorner: p(-1, 0, 0) },
    { up: p(1, 0, 0) },
    { lift: NaN },
    { upperLipMiddle: p(Infinity, 0, 0) },
  ])
    TestValidator.predicate(
      "invalid frame refuses",
      throwsError(
        () => attachPortraitDentalRow(row, { ...frame, ...patch }),
        "Dental attachment",
      ),
    );
  TestValidator.predicate(
    "missing normals refuse",
    throwsError(
      () => attachPortraitDentalRow({ ...row, normals: null }, frame),
      "normals",
    ),
  );
  TestValidator.predicate(
    "nonfinite input refuses",
    throwsError(
      () =>
        attachPortraitDentalRow(
          {
            ...row,
            positions: row.positions.map((v, i) => (i === 0 ? Infinity : v)),
          },
          frame,
        ),
      "representable",
    ),
  );
};
