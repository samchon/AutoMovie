import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import { throwsError } from "../internal/predicates";

/**
 * The optional aegyo-sal group owns one pretarsal crest and its short lower
 * shoulder. It is kept separate from the optical opening and from the
 * preseptal transition so omission remains a valid eyelid-only construction.
 *
 * Scenarios:
 * 1. Supplying the group changes only lower internal rows and leaves the
 *    aperture identities fixed.
 * 2. Component construction copies the nested object and its weight array.
 * 3. Nonfinite, unordered and out-of-range optional values refuse early.
 */
export const test_subject_aegyo_sal = (): void => {
  const socket = portraitEyeSockets[0];
  const base: IPortraitEyeShape = {
    ...portraitEyeShape,
    aegyoSal: undefined,
    browFibres: 0,
    upperLashes: 1,
    lidContact: undefined,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 12, irisRows: 3 },
  };
  const roll = {
    offset: 1.1,
    projection: 1.05,
    width: 4.8,
    height: 2.9,
    reach: 8,
    weights: [0.18, 0.58, 0.9, 1, 0.9, 0.58, 0.18],
  };
  const attach = (shape: IPortraitEyeShape) => {
    const cage = {
      positions: referenceControlNet.positions.map((point) => [...point]),
      indices: [] as number[],
      groups: [] as number[],
    };
    const margin = appendPortraitEyeMargins(
      cage,
      referenceControlNet.positions,
      socket,
      shape,
    );
    return { cage, margin };
  };
  const plain = attach(base),
    detailed = attach({ ...base, aegyoSal: roll });
  for (const id of [...socket.top, ...socket.bottom])
    TestValidator.equals(
      "aegyo-sal retains aperture boundary",
      detailed.cage.positions[detailed.margin.get(id)!],
      plain.cage.positions[plain.margin.get(id)!],
    );
  TestValidator.predicate(
    "aegyo-sal changes internal lower rows",
    detailed.cage.positions.some((point, id) =>
      point.some((value, axis) => value !== plain.cage.positions[id][axis]),
    ),
  );

  const component = createPortraitEyeComponent(socket, {
    ...base,
    aegyoSal: roll,
  });
  const build = () =>
    buildPortraitHead(referenceControlNet, [component], 1).refined;
  const remembered = JSON.stringify(build());
  roll.projection = 99;
  roll.weights[3] = 0;
  TestValidator.equals(
    "component owns aegyo-sal input",
    JSON.stringify(build()),
    remembered,
  );

  for (const invalid of [
    { ...roll, projection: -1 },
    { ...roll, offset: Number.NaN },
    { ...roll, weights: [1] },
    { ...roll, weights: [0, 0, 0, 2, 0, 0, 0] },
  ])
    TestValidator.predicate(
      "invalid aegyo-sal refuses",
      throwsError(() =>
        createPortraitEyeComponent(socket, { ...base, aegyoSal: invalid }),
      ),
    );
};
