import { TestValidator } from "@nestia/e2e";

import { createPortraitCheekLayer } from "../../subjects/generated-korean-girl-01/cheeks";
import { createPortraitCheekFixture } from "../internal/createPortraitCheekFixture";
import { throwsError } from "../internal/predicates";

/**
 * Cheek authoring refuses malformed attachments and nonrepresentable relief
 * before an invalid or unbounded field population can enter the shared skin.
 *
 * Scenarios:
 * 1. Invalid sides, vertex identities and fold loops refuse, while the adjacent
 *    valid neutral configuration remains an empty deformation.
 * 2. Each volume's radii and displacements, and each fold dimension, validate
 *    independently. Missing/nonfinite host positions refuse at fit time.
 * 3. An active zero-length path, excessive sampling and overflow refuse without
 *    mutating input; a disabled fold does not require a nonzero path.
 */
export const test_subject_cheek_refusals = (): void => {
  for (const alter of [
    (s: ReturnType<typeof createPortraitCheekFixture>["socket"]) => {
      s.side = "middle" as "left";
    },
    (s: ReturnType<typeof createPortraitCheekFixture>["socket"]) => {
      s.malar = -1;
    },
    (s: ReturnType<typeof createPortraitCheekFixture>["socket"]) => {
      s.medial = 0.5;
    },
    (s: ReturnType<typeof createPortraitCheekFixture>["socket"]) => {
      s.nasolabial = [4];
    },
    (s: ReturnType<typeof createPortraitCheekFixture>["socket"]) => {
      s.nasolabial = [4, 4];
    },
  ]) {
    const f = createPortraitCheekFixture();
    alter(f.socket);
    TestValidator.predicate(
      "invalid attachment",
      throwsError(
        () => createPortraitCheekLayer(f.socket, f.shape),
        "attachments",
      ),
    );
  }
  for (const name of ["malar", "medial", "buccal", "modiolus"] as const)
    for (const [key, value] of [
      ["width", 0],
      ["height", -1],
      ["reach", 0],
      ["projection", NaN],
      ["lift", Infinity],
    ] as const) {
      const f = createPortraitCheekFixture();
      f.shape[name][key] = value;
      TestValidator.predicate(
        "invalid volume dimension",
        throwsError(
          () => createPortraitCheekLayer(f.socket, f.shape),
          "dimensions",
        ),
      );
    }
  for (const [key, value] of [
    ["foldWidth", 0],
    ["foldDepth", -1],
    ["foldReach", 0],
    ["foldDepth", NaN],
  ] as const) {
    const f = createPortraitCheekFixture();
    f.shape[key] = value;
    TestValidator.predicate(
      "invalid fold dimension",
      throwsError(
        () => createPortraitCheekLayer(f.socket, f.shape),
        "dimensions",
      ),
    );
  }
  const f = createPortraitCheekFixture();
  const missing = structuredClone(f.shape);
  Reflect.deleteProperty(missing.malar, "width");
  TestValidator.predicate(
    "missing dimension refuses at construction",
    throwsError(
      () => createPortraitCheekLayer(f.socket, missing),
      "dimensions",
    ),
  );
  const annotated = {
    ...f.shape,
    malar: { ...f.shape.malar, note: "author-owned metadata" },
  };
  TestValidator.equals(
    "metadata does not change numeric validation",
    createPortraitCheekLayer(f.socket, annotated).fields(f.host),
    [],
  );
  for (const point of [undefined, [0, 0], [0, NaN, 0]]) {
    const positions = f.host.positions.map((p) => [...p]);
    if (point === undefined) positions.length = 0;
    else positions[0] = point;
    TestValidator.predicate(
      "invalid resident position",
      throwsError(
        () =>
          createPortraitCheekLayer(f.socket, f.shape).fields({
            ...f.host,
            positions,
          }),
        "resident",
      ),
    );
  }
  const collapsed = {
    ...f.host,
    positions: f.host.positions.map((p, i) =>
      i === 5 ? [...f.host.positions[4]] : [...p],
    ),
  };
  TestValidator.equals(
    "disabled fold can be collapsed",
    createPortraitCheekLayer(f.socket, f.shape).fields(collapsed),
    [],
  );
  f.shape.foldDepth = 1;
  TestValidator.predicate(
    "active fold needs a path",
    throwsError(
      () => createPortraitCheekLayer(f.socket, f.shape).fields(collapsed),
      "nonzero",
    ),
  );
  TestValidator.predicate(
    "sampling is bounded",
    throwsError(
      () =>
        createPortraitCheekLayer(f.socket, {
          ...f.shape,
          foldWidth: 0.01,
        }).fields(f.host),
      "256",
    ),
  );
  TestValidator.equals(
    "sampling limit is inclusive",
    createPortraitCheekLayer(f.socket, { ...f.shape, foldWidth: 0.625 }).fields(
      f.host,
    ).length,
    256,
  );
  TestValidator.predicate(
    "adjacent sampling overflow refuses",
    throwsError(
      () =>
        createPortraitCheekLayer(f.socket, {
          ...f.shape,
          foldWidth: 0.624,
        }).fields(f.host),
      "256",
    ),
  );
  TestValidator.predicate(
    "normalized path remains finite",
    throwsError(
      () =>
        createPortraitCheekLayer(f.socket, {
          ...f.shape,
          foldWidth: Number.MIN_VALUE,
        }).fields(f.host),
      "finite nonzero",
    ),
  );
  const huge = {
    ...f.host,
    positions: f.host.positions.map((p, i) =>
      i === 4 ? [1e308, 0, 0] : i === 5 ? [1e308, 1e306, 0] : [...p],
    ),
  };
  TestValidator.predicate(
    "spline integration remains finite",
    throwsError(
      () =>
        createPortraitCheekLayer(f.socket, {
          ...f.shape,
          foldWidth: 1e306,
          foldReach: 1e306,
        }).fields(huge),
      "remain finite",
    ),
  );
  const curve = { ...f.host, positions: [...f.host.positions, [0, 0, 0]] };
  const curvedSocket = { ...f.socket, nasolabial: [4, 6, 5] };
  const chordLength = 2 * Math.hypot(40, 80);
  TestValidator.predicate(
    "curve has a resolvable positive twin",
    createPortraitCheekLayer(curvedSocket, {
      ...f.shape,
      foldWidth: chordLength / 100,
    }).fields(curve).length > 0,
  );
  TestValidator.predicate(
    "curvature enters the sampling budget",
    throwsError(
      () =>
        createPortraitCheekLayer(curvedSocket, {
          ...f.shape,
          foldWidth: chordLength / 127.99,
        }).fields(curve),
      "curved",
    ),
  );
  const subnormal = {
    ...f.host,
    positions: f.host.positions.map((p, i) =>
      i === 4 ? [0, 0, 0] : i === 5 ? [1e-15, 0, 0] : [...p],
    ),
  };
  TestValidator.predicate(
    "sampled support travel cannot underflow to zero",
    throwsError(
      () =>
        createPortraitCheekLayer(f.socket, {
          ...f.shape,
          foldWidth: Number.MAX_VALUE,
        }).fields(subnormal),
      "nonzero sampled path",
    ),
  );
};
