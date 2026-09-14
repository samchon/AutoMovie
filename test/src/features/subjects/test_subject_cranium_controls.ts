import {
  type IPortraitCraniumShape,
  resolvePortraitCraniumShape,
} from "@automovie/human/components/craniumShape";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Cranial sections have explicit replacement and host-relative floor semantics.
 *
 * Scenarios:
 * 1. Omitted controls retain a floor 4.5 mm below the host chin and the declared cap/frame.
 * 2. A five-section override and planar cap retain every supplied value without aliasing input.
 * 3. Nonfinite dimensions, invalid envelopes, section order/count and transition limits refuse.
 * 4. The maximum section population, positive frame boundary and interior transition remain valid.
 */
export const test_subject_cranium_controls = (): void => {
  const basic = resolvePortraitCraniumShape(-80);
  TestValidator.equals("chin-relative floor", basic.stations[0].floor, -84.5);
  TestValidator.equals("default cap", basic.capDepth, 4);
  TestValidator.equals("default angular frame", basic.frame, {
    width: 71,
    height: 79,
    centerY: 5,
  });
  const input: IPortraitCraniumShape = {
    stations: Array.from({ length: 5 }, (_, i) => ({
      z: -20 - 20 * i,
      crownZ: -20 - 20 * i,
      width: 70 - 10 * i,
      crown: 100,
      floor: -70,
    })),
    capDepth: 0,
    transition: 0.5,
    frame: { width: 60, height: 70, centerY: 2 },
  };
  const replacement = resolvePortraitCraniumShape(-100, input);
  TestValidator.equals(
    "absolute floor ignores chin",
    replacement.stations[0].floor,
    -70,
  );
  TestValidator.equals(
    "complete station replacement",
    replacement.stations.length,
    5,
  );
  TestValidator.equals("planar cap", replacement.capDepth, 0);
  input.stations![0].width = 1;
  input.frame!.width = 1;
  TestValidator.equals("stations copied", replacement.stations[0].width, 70);
  TestValidator.equals("frame copied", replacement.frame.width, 60);
  const stations = replacement.stations;
  for (const invalid of [
    { capDepth: -1 },
    { capDepth: Infinity },
    { transition: 0 },
    { transition: 1 },
    { frame: { width: 0, height: 70, centerY: 0 } },
    { frame: { width: 70, height: 0, centerY: 0 } },
    { frame: { width: 70, height: 70, centerY: NaN } },
    { stations: [] },
    { stations: stations.slice(0, 4) },
    {
      stations: Array.from({ length: 65 }, (_, i) => ({
        ...stations[0],
        z: -20 - i,
        crownZ: -20 - i,
      })),
    },
    ...[
      { width: 0 },
      { crown: -70 },
      { floor: 101 },
      { z: NaN },
      { crownZ: -21 },
    ].map((change) => ({
      stations: [{ ...stations[0], ...change }, ...stations.slice(1)],
    })),
    {
      stations: [
        stations[0],
        { ...stations[1], z: stations[0].z },
        ...stations.slice(2),
      ],
    },
  ] satisfies IPortraitCraniumShape[]) {
    TestValidator.predicate(
      "invalid cranial envelope",
      throwsError(() => resolvePortraitCraniumShape(-80, invalid)),
    );
  }
  TestValidator.predicate(
    "nonfinite host chin",
    throwsError(() => resolvePortraitCraniumShape(NaN)),
  );
  const limit = resolvePortraitCraniumShape(-80, {
    stations: Array.from({ length: 64 }, (_, i) => ({
      ...stations[0],
      z: -20 - i,
      crownZ: -20 - i,
    })),
    transition: 0.001,
    frame: { width: 0.01, height: 0.01, centerY: 0 },
  });
  TestValidator.equals(
    "maximum population admitted",
    limit.stations.length,
    64,
  );
};
