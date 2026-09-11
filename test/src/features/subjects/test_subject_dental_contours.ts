import { validateMeshTopology } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitDentalCrown,
  buildPortraitDentalCrown,
} from "../../subjects/generated-korean-girl-01/dentalCrown";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Optional proximal detail preserves the basic crown while independently
 * controlling its two anatomical sides and the group's mesial orientation.
 * Scenarios:
 * 1. Omitted and empty detail are exact identity. Unequal side profiles retain
 *    an 8mm maximum width, explicit cervical extents and incisal corner heights.
 * 2. Unaligned contact heights are actually sampled, a mirrored mesial frame
 *    swaps the contours, zero rise is honored and the mesh stays closed.
 * 3. Invalid contact fractions, cervical ratios, corner rises and group axes
 *    refuse beside their valid default and detailed counterparts.
 */
export const test_subject_dental_contours = (): void => {
  const base = {
    width: 8,
    height: 10,
    depth: 1.5,
    cervicalWidth: 0.8,
    edgeRise: 0.3,
  };
  const plain = buildPortraitDentalCrown(base);
  TestValidator.equals(
    "empty detail preserves basic formula",
    buildPortraitDentalCrown({ ...base, contour: { mesial: {}, distal: {} } }),
    plain,
  );
  const shape: IPortraitDentalCrown = {
    ...base,
    contour: {
      mesial: { contactHeight: 0.23, cervicalWidth: 0.9, incisalRise: 0.1 },
      distal: { contactHeight: 0.37, cervicalWidth: 0.7, incisalRise: 0.6 },
    },
  };
  const detailed = buildPortraitDentalCrown(shape, 1);
  const x = detailed.positions.filter((_, i) => i % 3 === 0);
  TestValidator.predicate(
    "contact crests retain exact declared width",
    nclose(Math.max(...x), 4) && nclose(Math.min(...x), -4),
  );
  const top = x.filter((_, i) => nclose(detailed.positions[3 * i + 1], 5));
  TestValidator.predicate(
    "independent cervical ratios have known extents",
    nclose(Math.min(...top), -2.8) && nclose(Math.max(...top), 3.6),
  );
  TestValidator.predicate(
    "independent incisal corners have known heights",
    nclose(detailed.positions[1], -4.9) &&
      nclose(detailed.positions[16 * 3 + 1], -4.4),
  );
  TestValidator.predicate(
    "off-grid mesial contact is present",
    detailed.positions.some(
      (v, i) =>
        i % 3 === 0 &&
        nclose(v, 4) &&
        nclose(detailed.positions[i + 1], -5 + 2.3 + 0.1 * 0.77 ** 4),
    ),
  );
  const opposite = buildPortraitDentalCrown(shape, -1);
  const oppositeTop = opposite.positions.filter(
    (_, i) => i % 3 === 0 && nclose(opposite.positions[i + 1], 5),
  );
  TestValidator.predicate(
    "group direction swaps the cervical sides",
    nclose(Math.min(...oppositeTop), -3.6) &&
      nclose(Math.max(...oppositeTop), 2.8),
  );
  TestValidator.predicate(
    "detailed surface stays closed",
    validateMeshTopology({ mesh: detailed, expectClosed: true }).success,
  );
  const zero = buildPortraitDentalCrown({
    ...base,
    contour: { mesial: { incisalRise: 0 } },
  });
  TestValidator.predicate(
    "explicit zero does not fall back to base rise",
    nclose(zero.positions[1], -5),
  );
  for (const change of [
    { contactHeight: 0 },
    { contactHeight: 1 },
    { contactHeight: NaN },
    { cervicalWidth: 0 },
    { cervicalWidth: 1.1 },
    { incisalRise: -1 },
    { incisalRise: 5 },
    { incisalRise: Infinity },
  ])
    for (const side of ["mesial", "distal"] as const)
      TestValidator.predicate(
        "invalid proximal detail refuses",
        throwsError(
          () =>
            buildPortraitDentalCrown({ ...base, contour: { [side]: change } }),
          "side contours",
        ),
      );
  for (const direction of [0, 0.5, NaN])
    TestValidator.predicate(
      "invalid group direction refuses",
      throwsError(
        () => buildPortraitDentalCrown(base, direction),
        "mesial direction",
      ),
    );
};
