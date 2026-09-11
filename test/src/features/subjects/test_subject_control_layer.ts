import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createPortraitControlLayer } from "../../subjects/portraitControlLayer";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Coupled controls prescribe the resulting movement, so a neighbouring zero
 * witness remains fixed even inside another control's compact support.
 *
 * Scenarios:
 * 1. Two overlapping supports have the independently derived 2x2 inverse with
 *    off-diagonal 27/64. The engine reproduces both target movements and the
 *    halfway interpolation; replacing the second zero by motion changes it.
 * 2. Input order and caller mutation cannot change the layer. Empty/all-zero
 *    controls are identity, and a translated datum moves the common support.
 * 3. Malformed names, vectors, radius, cardinality and bindings refuse. Distinct
 *    close controls refuse unstable solves and finite but overflowing inputs
 *    refuse. The exact 96-control limit and separated controls remain valid.
 */
export const test_subject_control_layer = (): void => {
  const host = {
    positions: [
      [0, 0, 0],
      [5, 0, 0],
    ],
    indices: [],
    normals: [],
  };
  const controls = [
    { name: "a", anchor: 0, offset: [0, 0, 0], displacement: [0, 0, 0.2] },
    { name: "b", anchor: 1, offset: [0, 0, 0], displacement: [0, 0, 0] },
  ];
  const layer = createPortraitControlLayer("nose", 10, controls);
  const fields = layer.fields(host);
  TestValidator.equals("both coupled coefficients exist", fields.length, 2);
  const w = 27 / 64;
  const first = 0.0002 / (1 - w * w),
    second = -w * first;
  TestValidator.predicate(
    "coupled inverse oracle",
    nclose(fields[0].displacement.z, first, 1e-12) &&
      nclose(fields[1].displacement.z, second, 1e-12),
  );
  const mesh = {
    positions: [0, 0, 0, 0.005, 0, 0, 0.0025, 0, 0, 0.02, 0, 0],
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  };
  const result = createAutoMovieMeshDeformer(fields)(mesh);
  TestValidator.predicate(
    "actual engine reaches both requested controls",
    nclose(result.positions[2], 0.0002, 1e-12) &&
      nclose(result.positions[5], 0, 1e-12),
  );
  TestValidator.predicate(
    "halfway polynomial oracle",
    nclose(result.positions[8], (15 / 16) ** 3 * (first + second), 1e-12),
  );
  TestValidator.equals(
    "outside support",
    result.positions.slice(9),
    mesh.positions.slice(9),
  );
  const moved = createPortraitControlLayer("nose", 10, [
    controls[0],
    { ...controls[1], displacement: [0, 0, 0.1] },
  ]).fields(host);
  TestValidator.predicate(
    "zero witness negative twin",
    nclose(
      createAutoMovieMeshDeformer(moved)(mesh).positions[5],
      0.0001,
      1e-12,
    ),
  );
  TestValidator.equals(
    "permutation invariance",
    createPortraitControlLayer("nose", 10, [...controls].reverse()).fields(
      host,
    ),
    fields,
  );
  // The close pair followed by a farther point requires a later pivot exchange;
  // all three movements must survive that exchange with their original owners.
  const triple = [0, 1, 5].map((x, i) => ({
    name: String(i),
    anchor: 0,
    offset: [x, 0, 0],
    displacement: [0, 0, i === 1 ? 0 : 0.1],
  }));
  const tripleFields = createPortraitControlLayer("nose", 10, triple).fields(
    host,
  );
  const tripleResult = createAutoMovieMeshDeformer(tripleFields)({
    ...mesh,
    positions: [0, 0, 0, 0.001, 0, 0, 0.005, 0, 0],
  });
  for (let i = 0; i < 3; i++)
    TestValidator.predicate(
      "pivot preserves every target",
      nclose(
        tripleResult.positions[3 * i + 2],
        triple[i].displacement[2] / 1000,
        1e-12,
      ),
    );
  controls[0].displacement[2] = 9;
  controls[1].offset[0] = 99;
  TestValidator.equals("owned control data", layer.fields(host), fields);
  const neutral = {
    name: "single",
    anchor: 0,
    offset: [0, 0, 0],
    displacement: [0, 0, 0],
  };
  TestValidator.equals(
    "empty controls",
    createPortraitControlLayer("nose", 10, []).fields(host),
    [],
  );
  TestValidator.equals(
    "neutral controls",
    createPortraitControlLayer("nose", 10, [neutral]).fields(host),
    [],
  );
  const single = createPortraitControlLayer("nose", 10, [
    { ...neutral, offset: [1, 2, 3], displacement: [0.1, -0.2, 0.3] },
  ]);
  const shifted = single.fields({ ...host, positions: [[10, -10, 20]] });
  TestValidator.predicate(
    "live translated frame and all axes",
    nclose(shifted[0].center.x, 0.011) &&
      nclose(shifted[0].center.y, -0.008) &&
      nclose(shifted[0].center.z, 0.023) &&
      nclose(shifted[0].displacement.x, 0.0001) &&
      nclose(shifted[0].displacement.y, -0.0002) &&
      nclose(shifted[0].displacement.z, 0.0003),
  );
  const many = Array.from({ length: 96 }, (_, i) => ({
    ...neutral,
    name: String(i).padStart(2, "0"),
    offset: [20 * i, 0, 0],
  }));
  TestValidator.equals(
    "exact cardinality limit",
    createPortraitControlLayer("nose", 10, many).fields(host),
    [],
  );
  for (const radius of [0, -1, NaN, Infinity, Number.MIN_VALUE])
    TestValidator.predicate(
      "invalid radius",
      throwsError(() => createPortraitControlLayer("nose", radius, [])),
    );
  TestValidator.predicate(
    "blank layer identity",
    throwsError(() => createPortraitControlLayer(" ", 10, [])),
  );
  for (const invalid of [
    [...many, { ...neutral, name: "extra" }],
    [neutral, neutral],
    [{ ...neutral, name: " " }],
    [{ ...neutral, anchor: -1 }],
    [{ ...neutral, anchor: 0.5 }],
    [{ ...neutral, offset: [0, 0] }],
    [{ ...neutral, displacement: [NaN, 0, 0] }],
  ])
    TestValidator.predicate(
      "invalid control data",
      throwsError(() => createPortraitControlLayer("nose", 10, invalid)),
    );
  for (const positions of [[], [[0, 0]], [[0, NaN, 0]]])
    TestValidator.predicate(
      "invalid live binding",
      throwsError(() => single.fields({ ...host, positions }), "finite datum"),
    );
  TestValidator.predicate(
    "overflowing center",
    throwsError(
      () =>
        createPortraitControlLayer("nose", 10, [
          { ...neutral, offset: [Number.MAX_VALUE, 0, 0] },
        ]).fields({ ...host, positions: [[Number.MAX_VALUE, 0, 0]] }),
      "centers exceed",
    ),
  );
  for (const distance of [0, 1e-6])
    TestValidator.predicate(
      "unresolved coupled controls",
      throwsError(
        () =>
          createPortraitControlLayer("nose", 10, [
            neutral,
            { ...neutral, name: "second", offset: [distance, 0, 0] },
          ]).fields(host),
        "singular",
      ),
    );
  TestValidator.predicate(
    "overflowing coefficients",
    throwsError(
      () =>
        createPortraitControlLayer("nose", 10, [
          { ...neutral, name: "a", displacement: [Number.MAX_VALUE, 0, 0] },
          {
            ...neutral,
            name: "b",
            offset: [5, 0, 0],
            displacement: [-Number.MAX_VALUE, 0, 0],
          },
        ]).fields(host),
      "coefficients exceed",
    ),
  );
};
