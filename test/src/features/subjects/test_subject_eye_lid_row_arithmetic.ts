import {
  portraitEyeLidRows,
  portraitEyeLoop,
} from "@automovie/human/components/eyeLidRows";
import type { IPortraitEyeSocket } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { nclose } from "../internal/predicates";

/**
 * A four-corner aperture makes the shared row formula independently measurable.
 * No assembled mesh or copied output supplies the expected section coordinates.
 *
 * Scenarios:
 * 1. The loop owns each canthus once, with lower and upper tissue on opposite sides.
 * 2. At the medial plane, named upper/lower rows match hand-evaluated dimensions.
 * 3. A moving contact with a fixed guide retains its outer XY attachment and
 *    prescribed depth; its inner row follows contact and its ridge fades by the
 *    cubic section weight. Without the guide, the whole attachment translates.
 * 4. Sampling owns its output and does not mutate the input coordinates.
 */
export const test_subject_eye_lid_row_arithmetic = (): void => {
  const source = [
    [0, 0, 10],
    [2, 1, 10],
    [4, 0, 10],
    [2, -1, 10],
  ];
  const socket: IPortraitEyeSocket = {
    name: "left",
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 1,
    browTop: [],
    browBottom: [],
  };
  const shape = {
    ...portraitEyeShapeFixture(),
    foldWidth: 2,
    foldDepth: 0.4,
    upperLidVolume: 0.3,
    lowerLidWidth: 1,
    lowerLidVolume: 0.2,
    lidThickness: 0.1,
    aegyoSal: undefined,
  };
  const before = structuredClone(source);
  const check = (name: string, actual: number[], expected: number[]) =>
    TestValidator.predicate(
      name,
      actual.length === expected.length &&
        actual.every((value, axis) => nclose(value, expected[axis])),
    );
  TestValidator.equals(
    "single canthal ownership",
    portraitEyeLoop(socket),
    [0, 3, 2, 1],
  );
  const rows = portraitEyeLidRows(source, socket, shape);
  check("canthal attachment", rows[0].outer, [-1.2, 0, 9.6]);
  check("lower attachment", rows[1].outer, [2, -3.2, 9.6]);
  check("lower crest", rows[1].tarsal, [2, -1.65, 10.3]);
  check("upper attachment", rows[3].outer, [2, 6.4, 9.8]);
  check("upper crest", rows[3].tarsal, [2, 2.45, 10.48]);
  check("upper crease", rows[3].creaseInner, [2, 3.4, 9.7]);

  const moving = source.map(([x, y, z]) => [x + 3, y - 2, z + 3]);
  const depth = new Map(source.map((_, id) => [id, 20]));
  const guided = portraitEyeLidRows(
    moving,
    socket,
    shape,
    depth,
    undefined,
    source,
  )[3];
  check("fixed outer projection", guided.outer, [2, 6.4, 19.8]);
  check("inner follows contact", guided.inner, [5, -1, 13.1]);
  // Ridge fraction = 0.18 / 5.4 = 1/30; cubic blend = 44/13500.
  const blend = 44 / 13500;
  check("intermediate cubic transport", guided.ridge, [
    2 + 3 * (1 - blend),
    1.18 - 2 * (1 - blend),
    13.18 + 7 * blend,
  ]);
  const unguided = portraitEyeLidRows(moving, socket, shape, depth)[3];
  check("without guide outer follows contact", unguided.outer, [5, 4.4, 19.8]);
  guided.inner[0] = 100;
  TestValidator.equals("reference source unchanged", source, before);
  TestValidator.equals("contact source unchanged", moving[1], [5, -1, 13]);
};
