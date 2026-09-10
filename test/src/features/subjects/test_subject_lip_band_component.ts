import { TestValidator } from "@nestia/e2e";

import { portraitMouthShape } from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitMouthComponent } from "../../subjects/generated-korean-girl-01/mouth";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Band thickness belongs to the lips' outer boundary, independently of the
 * oral opening. A hand-authored annulus distinguishes the two responsibilities.
 *
 * Scenarios:
 * 1. A lower one-half profile moves outer Y -3 to -2 and middle Y -2 to -1.5,
 *    retaining the entire inner rim, upper band and cut identities.
 * 2. Upper detail is its side-reversed twin. Neutral detail is exact identity;
 *    later array mutation cannot alter a fitted component.
 * 3. Opening scale composes after local thickness, rather than replacing it.
 *    Invalid optional upper and lower ratios refuse at component construction.
 */
export const test_subject_lip_band_component = (): void => {
  const positions = [
    [-4, 0, 0],
    [0, -3, 0],
    [4, 0, 0],
    [0, 3, 0],
    [-3, 0, 0],
    [0, -2, 0],
    [3, 0, 0],
    [0, 2, 0],
    [-2, 0, 0],
    [0, -1, 0],
    [2, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ];
  const indices: number[] = [];
  for (const offset of [0, 4])
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      indices.push(
        offset + i,
        offset + j,
        offset + j + 4,
        offset + i,
        offset + j + 4,
        offset + i + 4,
      );
    }
  for (let i = 0; i < 4; i++) indices.push(8 + i, 8 + ((i + 1) % 4), 12);
  const host = { positions, indices, viewRay: [0, 0, 1] };
  const socket = {
    outer: [0, 1, 2, 3],
    lower: [8, 9, 10],
    upper: [8, 11, 10],
    lipSeed: 5,
  };
  const shape = {
    ...portraitMouthShape,
    // The production smile lifts its corners, but this fixture isolates the
    // thickness transform. Keep every unrelated positional contributor at its
    // neutral value so the oracle names only the lower-band ratio.
    widthScale: 1,
    openingScale: 1,
    cornerLift: 0,
    band: undefined,
    section: undefined,
    crowns: [],
  };
  const baseline = createPortraitMouthComponent(socket, shape).fit(host);
  const knots = [
    { at: -1, scale: 1 },
    { at: 0, scale: 0.5 },
    { at: 1, scale: 1 },
  ];
  const component = createPortraitMouthComponent(socket, {
    ...shape,
    band: { lower: knots },
  });
  const changed = component.fit(host);
  TestValidator.equals(
    "annulus owns twelve lip vertices",
    baseline.constraints.length,
    12,
  );
  TestValidator.equals(
    "aperture cuts stay fixed",
    changed.cutFaces,
    baseline.cutFaces,
  );
  const expectedY = positions.slice(0, 12).map((p) => p[1]);
  expectedY[1] = -2;
  expectedY[5] = -1.5;
  for (const constraint of changed.constraints)
    TestValidator.predicate(
      "independent lower thickness oracle",
      nclose(constraint.target[1], expectedY[constraint.vertex]) &&
        nclose(constraint.target[0], positions[constraint.vertex][0]) &&
        nclose(constraint.target[2], 0),
    );
  const upper = createPortraitMouthComponent(socket, {
    ...shape,
    band: { upper: 0.5 },
  }).fit(host);
  for (const c of upper.constraints)
    TestValidator.predicate(
      "upper detail is independent",
      nclose(
        c.target[1],
        c.vertex === 3 ? 2 : c.vertex === 7 ? 1.5 : positions[c.vertex][1],
      ),
    );
  for (const band of [{}, { upper: 1, lower: 1 }])
    TestValidator.equals(
      "neutral band is exact identity",
      createPortraitMouthComponent(socket, { ...shape, band }).fit(host)
        .constraints,
      baseline.constraints,
    );
  knots[1].scale = 2;
  TestValidator.equals(
    "component owns profile",
    component.fit(host).constraints,
    changed.constraints,
  );
  const opened = createPortraitMouthComponent(socket, {
    ...shape,
    openingScale: 2,
    band: { lower: 0.5 },
  }).fit(host);
  for (const c of opened.constraints)
    TestValidator.predicate(
      "opening follows thickness",
      nclose(c.target[1], 2 * expectedY[c.vertex]),
    );
  for (const band of [{ upper: 0 }, { lower: [] }])
    TestValidator.predicate(
      "invalid detail refuses through consumer",
      throwsError(
        () => createPortraitMouthComponent(socket, { ...shape, band }),
        "ordered positive",
      ),
    );
};
