import type { IPortraitSkinShape } from "@automovie/human/components/skinShape";

import { humanFaceFixture } from "./humanFaceFixture";

/** A hand-authored inclined skin plane with independently located attachments. */
export function portraitSkinFixture() {
  const positions = [
    [-100, -100, -50],
    [100, -100, -50],
    [100, 150, 75],
    [-100, 150, 75],
  ];
  const curve = (points: number[][]) =>
    points.map(([x, y]) => positions.push([x, y, 99]) - 1);
  const bindings = structuredClone(humanFaceFixture().basis.bindings);
  for (const side of ["right", "left"] as const) {
    const x = side === "right" ? -25 : 25;
    bindings.eyes[side].top = curve([
      [x - 15, 10],
      [x, 12],
      [x + 15, 10],
    ]);
    bindings.eyes[side].bottom = curve([
      [x - 15, 10],
      [x, 5],
      [x + 15, 10],
    ]);
    bindings.eyes[side].browBottom = curve([
      [x - 15, 25],
      [x, 25],
      [x + 15, 25],
    ]);
  }
  bindings.mouth.upper = curve([
    [-20, -25],
    [0, -23],
    [20, -25],
  ]);
  bindings.mouth.lower = curve([
    [-20, -25],
    [0, -30],
    [20, -25],
  ]);
  const zero: IPortraitSkinShape = {
    laxity: 1,
    forehead: 0,
    glabella: 0,
    crowFeet: 0,
    lowerLid: 0,
    nasolabial: 0,
    marionette: 0,
    perioral: 0,
    cheekSag: 0,
    jowlSag: 0,
    underEyeBag: 0,
    volumeLoss: 0,
  };
  return {
    host: { positions, indices: [0, 1, 2, 0, 2, 3], normals: [] },
    bindings,
    zero,
  };
}
