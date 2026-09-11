import { TestValidator } from "@nestia/e2e";

import { createPortraitNasalSection } from "../../subjects/generated-korean-girl-01/nasalSection";
import { throwsError } from "../internal/predicates";

/**
 * Nasal section inputs must define a finite, bounded cubic surface and a usable
 * local frame before they can move a shared skin or aperture vertex.
 *
 * Scenarios:
 * 1. Too few/many or unordered/nonfinite controls, ragged/nonfinite depth rows,
 *    unrepresentable axis spans, invalid join widths and invalid influence refuse.
 * 2. Finite XYZ points and datum are required. An overflowing relative frame
 *    or depth delta refuses instead of publishing nonfinite nasal geometry.
 * 3. Adjacent valid profiles and finite neutral samples remain usable.
 */
export const test_subject_nasal_section_refusals = (): void => {
  const base = () => ({
    transverse: [-3, -1, 1, 3],
    stations: [-3, -1, 1, 3].map((height) => ({
      height,
      depths: [1, 1, 1, 1],
    })),
    joinWidth: 1,
    influence: 1,
  });
  const refuse = (input: ReturnType<typeof base>) =>
    TestValidator.predicate(
      "invalid cubic profile refuses",
      throwsError(
        () => createPortraitNasalSection(input),
        "ordered finite cubic controls",
      ),
    );
  for (const count of [0, 3, 65]) {
    const x = base();
    x.transverse = Array.from({ length: count }, (_v, i) => i);
    refuse(x);
    const y = base();
    y.stations = Array.from({ length: count }, (_v, i) => ({
      height: i,
      depths: [1, 1, 1, 1],
    }));
    refuse(y);
  }
  for (const invalid of [NaN, Infinity, -Infinity, -3]) {
    const x = base();
    x.transverse[1] = invalid;
    refuse(x);
    const y = base();
    y.stations[1].height = invalid;
    refuse(y);
  }
  for (const dimension of ["x", "y"]) {
    const input = base();
    const values = [-Number.MAX_VALUE, -1, 1, Number.MAX_VALUE];
    if (dimension === "x") input.transverse = values;
    else
      input.stations.forEach((station, i) => {
        station.height = values[i];
      });
    refuse(input);
  }
  const ragged = base();
  ragged.stations[1].depths.pop();
  refuse(ragged);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const input = base();
    input.stations[1].depths[1] = invalid;
    refuse(input);
  }
  for (const joinWidth of [0, -1, 3.01, NaN, Infinity])
    refuse({ ...base(), joinWidth });
  const narrowY = base();
  narrowY.stations.forEach((station) => {
    station.height /= 4;
  });
  refuse(narrowY);
  for (const influence of [-0.01, 1.01, NaN, Infinity])
    refuse({ ...base(), influence });

  const section = createPortraitNasalSection(base());
  for (const invalid of [
    [0, 0],
    [0, 0, NaN],
    [0, Infinity, 0],
  ])
    for (const pair of [
      [invalid, [0, 0, 0]],
      [[0, 0, 0], invalid],
    ])
      TestValidator.predicate(
        "invalid point or datum refuses",
        throwsError(() => section(pair[0], pair[1]), "finite XYZ"),
      );
  TestValidator.predicate(
    "relative frame overflow refuses",
    throwsError(
      () => section([Number.MAX_VALUE, 0, 0], [-Number.MAX_VALUE, 0, 0]),
      "local frame",
    ),
  );
  const extreme = base();
  extreme.stations.forEach((station) => {
    station.depths.fill(Number.MAX_VALUE);
  });
  TestValidator.predicate(
    "target depth overflow refuses",
    throwsError(
      () =>
        createPortraitNasalSection(extreme)(
          [0, 0, 0],
          [0, 0, Number.MAX_VALUE],
        ),
      "depth range",
    ),
  );
  TestValidator.equals(
    "neutral never evaluates an unused overflowing target",
    createPortraitNasalSection({ ...extreme, influence: 0 })(
      [0, 0, 0],
      [0, 0, Number.MAX_VALUE],
    ),
    0,
  );
  TestValidator.equals(
    "finite zero influence remains identity",
    createPortraitNasalSection({ ...base(), influence: 0 })(
      [0, 0, 9],
      [0, 0, 0],
    ),
    0,
  );
  TestValidator.predicate(
    "exact half-span join remains admitted",
    Number.isFinite(
      createPortraitNasalSection({ ...base(), joinWidth: 3 })(
        [0, 0, 0],
        [0, 0, 0],
      ),
    ),
  );
};
