import { TestValidator } from "@nestia/e2e";

import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { throwsError } from "../internal/predicates";

/**
 * Upper tarsal volume and the lower soft-tissue roll are independent anatomical
 * dimensions; neither changes the aperture or the gaze marker as a side effect.
 *
 * Scenarios:
 * 1. A planar symmetric socket gains 1 mm above or 2 mm below independently,
 *    with unchanged opposite-side and aperture positions.
 * 2. A 3 mm lower transition moves its skin attachment 3 mm outwards while
 *    retaining the upper seam and gaze marker.
 * 3. Zero dimensions are valid; negative and nonfinite tissue sizes refuse.
 */
export const test_subject_eyelid_volume = (): void => {
  const host = {
    positions: [
      [-2, 0, 0],
      [0, 1, 0],
      [2, 0, 0],
      [0, -1, 0],
      [0, 0, 0],
    ],
    indices: [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4],
    viewRay: [0, 0, 1],
  };
  // A fitted lid now consumes supporting skin outside its opening. The broad
  // planar annulus supplies that host while preserving the original aperture.
  host.positions.push([-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]);
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    host.indices.push(
      outer[i],
      outer[j],
      inner[i],
      outer[j],
      inner[j],
      inner[i],
    );
  }
  const socket = {
    name: "left" as const,
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 4,
    browTop: [1],
    browBottom: [1],
  };
  const neutral = {
    ...portraitEyeShape,
    aegyoSal: undefined,
    // This scenario pins the basic scalar path, independently of a subject's
    // selected detailed section. Profile replacement has its own scenarios.
    lowerLidProfile: undefined,
    foldWidth: 0,
    foldDepth: 0,
    upperLidVolume: 0,
    lowerLidWidth: 0,
    lowerLidVolume: 0,
  };
  const build = (shape: IPortraitEyeShape) => {
    const cage = {
      positions: host.positions.map((point) => [...point]),
      indices: [] as number[],
      groups: [] as number[],
    };
    const rim = appendPortraitEyeMargins(cage, host.positions, socket, shape);
    return { cage, rim };
  };
  const before = build(neutral);
  for (const [change, sign, peak] of [
    [{ upperLidVolume: 1 }, 1, 1],
    [{ lowerLidVolume: 2 }, -1, 2],
  ] as const) {
    const after = build({ ...neutral, ...change });
    let maximum = 0;
    for (let i = 0; i < before.cage.positions.length; i++) {
      const a = before.cage.positions[i],
        b = after.cage.positions[i];
      const delta = b[2] - a[2];
      maximum = Math.max(maximum, delta);
      TestValidator.predicate(
        "volume keeps planar position",
        a[0] === b[0] && a[1] === b[1],
      );
      if (a[1] * sign <= 0)
        TestValidator.predicate(
          "opposite lid remains unchanged",
          Math.abs(delta) < 1e-10,
        );
    }
    TestValidator.predicate(
      "declared peak tissue volume",
      Math.abs(maximum - peak) < 1e-10,
    );
    for (const id of before.rim.values())
      TestValidator.equals(
        "aperture stays fixed",
        after.cage.positions[id],
        before.cage.positions[id],
      );
  }
  const original = createPortraitEyeComponent(socket, neutral).fit(host);
  const wider = createPortraitEyeComponent(socket, {
    ...neutral,
    lowerLidWidth: 3,
  }).fit(host);
  for (const originalPin of original.constraints) {
    const pin = wider.constraints.find(
      (value) => value.vertex === originalPin.vertex,
    )!;
    TestValidator.predicate(
      "only lower skin attachment expands",
      pin.target.every(
        (value, axis) =>
          Math.abs(
            value -
              originalPin.target[axis] -
              (originalPin.vertex === 3 && axis === 1 ? -3 : 0),
          ) < 1e-10,
      ),
    );
  }
  for (const field of [
    "upperLidVolume",
    "lowerLidWidth",
    "lowerLidVolume",
  ] as const)
    for (const value of [-1, NaN])
      TestValidator.predicate(
        "invalid lid tissue dimension refused",
        throwsError(() =>
          createPortraitEyeComponent(socket, { ...neutral, [field]: value }),
        ),
      );
};
