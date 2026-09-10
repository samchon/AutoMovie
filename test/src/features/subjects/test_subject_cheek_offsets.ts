import { TestValidator } from "@nestia/e2e";

import { createPortraitCheekLayer } from "../../subjects/generated-korean-girl-01/cheeks";
import { createPortraitCheekFixture } from "../internal/createPortraitCheekFixture";
import { throwsError } from "../internal/predicates";

/**
 * A local tissue-centre offset follows the live skin anchor and mirrors its
 * outward direction by anatomical side. Hand-defined centres are the oracle;
 * the kernel and the actual rendered appearance are checked separately.
 * Scenarios:
 * 1. Inward/up/forward controls produce mirrored metric centres, follow host
 *    translation, and remain owned when the caller changes its input tuple.
 * 2. Omitted and zero offsets preserve identical fields. Invalid tuples and
 *    an overflowing sum refuse instead of emitting an invalid engine field.
 */
export const test_subject_cheek_offsets = (): void => {
  const { socket, shape, host: sourceHost } = createPortraitCheekFixture();
  const host = {
    ...sourceHost,
    positions: sourceHost.positions.map((p) => [...p]),
  };
  host.positions[1] = [-20, -10, 3];
  shape.medial.projection = 1;
  shape.medial.offset = [-7, 6, 4];
  const right = createPortraitCheekLayer(socket, shape);
  TestValidator.equals("right inward centre", right.fields(host)[0].center, {
    x: -0.013,
    y: -0.004,
    z: 0.007,
  });
  const mirrored = {
    ...host,
    positions: host.positions.map(([x, y, z]) => [-x, y, z]),
  };
  TestValidator.equals(
    "left inward centre",
    createPortraitCheekLayer({ ...socket, side: "left" }, shape).fields(
      mirrored,
    )[0].center,
    { x: 0.013, y: -0.004, z: 0.007 },
  );
  shape.medial.offset[0] = 99;
  TestValidator.equals("offset ownership", right.fields(host)[0].center, {
    x: -0.013,
    y: -0.004,
    z: 0.007,
  });
  const moved = {
    ...host,
    positions: host.positions.map((p) => p.map((v, a) => v + [5, 2, -1][a])),
  };
  TestValidator.equals(
    "live translated anchor",
    right.fields(moved)[0].center,
    { x: -0.008, y: -0.002, z: 0.006 },
  );
  delete shape.medial.offset;
  const neutral = createPortraitCheekLayer(socket, shape).fields(host);
  shape.medial.offset = [0, 0, 0];
  TestValidator.equals(
    "neutral compatibility",
    createPortraitCheekLayer(socket, shape).fields(host),
    neutral,
  );
  for (const offset of [
    [1, 2],
    [1, NaN, 3],
  ])
    TestValidator.predicate(
      "invalid offset refuses",
      throwsError(
        () =>
          createPortraitCheekLayer(socket, {
            ...shape,
            medial: {
              ...shape.medial,
              offset: offset as [number, number, number],
            },
          }),
        "dimensions",
      ),
    );
  const large = {
    ...host,
    positions: host.positions.map((p, i) =>
      i === 1 ? [Number.MAX_VALUE, 0, 0] : p,
    ),
  };
  TestValidator.predicate(
    "offset sum overflow refuses",
    throwsError(
      () =>
        createPortraitCheekLayer(
          { ...socket, side: "left" },
          {
            ...shape,
            medial: { ...shape.medial, offset: [Number.MAX_VALUE, 0, 0] },
          },
        ).fields(large),
      "representable",
    ),
  );
};
