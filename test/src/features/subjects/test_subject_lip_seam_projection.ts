import { createPortraitMouthComponent } from "@automovie/human/components/mouth";
import { TestValidator } from "@nestia/e2e";

import { portraitMouthShape } from "../../subjects/generated-korean-girl-01/configuration";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Oral-rim depth is independent of aperture and outer vermilion placement.
 * Scenarios:
 * 1. A planar annulus advances both central rims by two mm and both halfway
 *    band samples by one mm, preserving all outer vertices and XY positions.
 * 2. Negative depth is the inverse, zero equals omission, and settings are owned.
 * 3. Nonfinite projection refuses before fitting; closed performance still
 *    pairs the advanced rims into exactly coincident contact.
 */
export const test_subject_lip_seam_projection = (): void => {
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
  const original = structuredClone(host);
  const socket = {
    outer: [0, 1, 2, 3],
    lower: [8, 9, 10],
    upper: [8, 11, 10],
    lipSeed: 5,
  };
  const shape = {
    ...portraitMouthShape,
    widthScale: 1,
    openingScale: 1,
    cornerLift: 0,
    upperLipProjection: 0,
    lowerLipProjection: 0,
    band: undefined,
    section: undefined,
    crowns: [],
  };
  const neutral = createPortraitMouthComponent(socket, shape).fit(host);
  for (const offset of [-2, 0, 2]) {
    const settings = { ...shape, seamProjection: offset };
    const component = createPortraitMouthComponent(socket, settings);
    const plan = component.fit(host);
    const weights = [0, 0, 0, 0, 0, 0.5, 0, 0.5, 0, 1, 0, 1];
    for (const pin of plan.constraints) {
      TestValidator.equals(
        "seam depth preserves XY",
        pin.target.slice(0, 2),
        positions[pin.vertex].slice(0, 2),
      );
      TestValidator.predicate(
        "independent seam-depth oracle",
        nclose(pin.target[2], offset * weights[pin.vertex]),
      );
    }
    TestValidator.equals(
      "depth preserves opening topology",
      plan.cutFaces,
      neutral.cutFaces,
    );
    if (offset === 0)
      TestValidator.equals(
        "zero is omission",
        plan.constraints,
        neutral.constraints,
      );
    settings.seamProjection = 99;
    TestValidator.equals(
      "component owns offset",
      component.fit(host).constraints,
      plan.constraints,
    );
  }
  for (const value of [NaN, Infinity, -Infinity, null as unknown as number])
    TestValidator.predicate(
      "nonfinite seam refuses",
      throwsError(
        () =>
          createPortraitMouthComponent(socket, {
            ...shape,
            seamProjection: value,
          }),
        "finite",
      ),
    );
  const closed = createPortraitMouthComponent(
    socket,
    { ...shape, seamProjection: 2 },
    { lipPart: 0, observedLipPart: 2 },
  ).fit(host);
  const pins = new Map(
    closed.constraints.map((pin) => [pin.vertex, pin.target]),
  );
  TestValidator.equals(
    "both advanced rims close together",
    pins.get(9),
    [0, 0, 2],
  );
  TestValidator.equals(
    "upper contact matches lower",
    pins.get(11),
    pins.get(9),
  );
  TestValidator.equals("host is immutable", host, original);
};
