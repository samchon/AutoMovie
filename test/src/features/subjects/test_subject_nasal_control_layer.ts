import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalLayerFor,
  portraitNasalRelief,
} from "../../subjects/generated-korean-girl-01/anatomy";
import { createPortraitReliefLayer } from "../../subjects/portraitRelief";
import { nclose } from "../internal/predicates";

/**
 * The nasal detail replaces one complete surface authority. Its common volume
 * field moves exterior and recessed lining coherently without a frozen collar.
 *
 * Scenarios:
 * 1. Omission reproduces basic relief fields; explicit empty detail removes them.
 * 2. One lateral control moves exterior, rim and lining samples by the same
 *    compact formula at their actual depths, with an independent polynomial
 *    oracle and an outside-support point that must remain unchanged.
 */
export const test_subject_nasal_control_layer = (): void => {
  const host = {
    positions: Array.from({ length: 359 }, (_, i) => [i, 0, 0]),
    indices: [],
    normals: [],
  };
  TestValidator.equals(
    "omission preserves basic nasal fields",
    portraitNasalLayerFor().fields(host),
    createPortraitReliefLayer("nasal-subunits", portraitNasalRelief).fields(
      host,
    ),
  );
  TestValidator.equals(
    "explicit empty removes relief",
    portraitNasalLayerFor({ radius: 10, controls: [] }).fields(host),
    [],
  );
  const fields = portraitNasalLayerFor({
    radius: 10,
    controls: [
      { name: "ala", anchor: 0, offset: [0, 0, 0], displacement: [0.2, 0, 0] },
    ],
  }).fields(host);
  const positions = [0, 0, 0, 0, 0, -0.002, 0, 0, -0.005, 0, 0, -0.02];
  const changed = createAutoMovieMeshDeformer(fields)({
    positions,
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  });
  for (const [i, expected] of [
    [0, 0.0002],
    [1, 0.0002 * 0.96 ** 3],
    [2, 0.0002 * 0.75 ** 3],
    [3, 0],
  ])
    TestValidator.predicate(
      "one exterior and lining volume",
      nclose(changed.positions[3 * i], expected, 1e-12) &&
        nclose(changed.positions[3 * i + 2], positions[3 * i + 2], 1e-12),
    );
};
