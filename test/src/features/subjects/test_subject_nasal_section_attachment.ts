import { TestValidator } from "@nestia/e2e";

import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The nasal loft must change exterior and aperture from one depth basis, while
 * the existing shared lining and unrelated socket controls retain ownership.
 *
 * Scenarios:
 * 1. A constant local depth flattens a tilted four-vertex rim to a hand-known
 *    Z plane. Exterior constraints and the first attached lining ring agree;
 *    positive and negative existing tip offsets remain additional displacements.
 * 2. Translating the host translates both the section datum and its targets.
 *    Zero section influence exactly reproduces an omitted section. An asymmetric
 *    Bernstein profile gives distinct rim depths and the corresponding lining.
 * 3. Missing, nonresident and nonfinite section datums refuse before attachment.
 */
export const test_subject_nasal_section_attachment = (): void => {
  const host = {
    positions: [
      [-2, -1, -1],
      [2, -1, -1],
      [2, 1, 1],
      [-2, 1, 1],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    viewRay: [0, 0, 1],
  };
  const socket = {
    midline: 0,
    tipY: 0,
    tipRadius: [1, 1] as [number, number],
    alarOffset: 1,
    alarY: 0,
    alarRadius: 1,
    surface: [0, 1, 2, 3],
    nostrils: [[0, 1]],
    sectionAnchor: 0,
  };
  const shape = {
    widthScale: 1,
    tipProjection: 0,
    alarProjection: 0,
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilRise: 0,
    nostrilTilt: 0,
    cavityContraction: 0.6,
    rimSupport: 0.1,
    rimRoundness: 0,
    cavityOffset: [0, 3, -5],
    blendReach: 0,
  };
  const section = {
    transverse: [-6, -2, 2, 6],
    stations: [-6, -2, 2, 6].map((height) => ({
      height,
      depths: [4, 4, 4, 4],
    })),
    joinWidth: 1,
    influence: 1,
  };
  const plan = createPortraitNoseComponent(socket, { ...shape, section }).fit(
    host,
  );
  TestValidator.predicate(
    "surface and rim use the same absolute section depth",
    plan.constraints.every(({ vertex, target }) =>
      target.every((value, axis) =>
        nclose(value, axis === 2 ? 3 : host.positions[vertex][axis]),
      ),
    ),
  );
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: [] as number[],
    groups: [] as number[],
  };
  plan.constraints.forEach(({ vertex, target }) => {
    cage.positions[vertex] = [...target];
  });
  plan.attach(cage, cage.positions, () => 0);
  TestValidator.predicate(
    "lining follows that same fitted depth",
    cage.positions[4].every((value, axis) =>
      nclose(value, [-1.92, -0.66, 2.5][axis]),
    ),
  );
  for (const projection of [-2, 2]) {
    const offset = createPortraitNoseComponent(socket, {
      ...shape,
      section,
      tipProjection: projection,
    }).fit(host);
    // Each witness is two radii from the tip axis and one radius vertically:
    // the additional Gaussian displacement is projection*exp(-(2^2+1^2)).
    TestValidator.predicate(
      "signed tip offset composes on the loft basis",
      offset.constraints.every(({ target }) =>
        nclose(target[2], 3 + projection * Math.exp(-5), 1e-8),
      ),
    );
  }
  const translation = [7, -3, 11];
  const translated = createPortraitNoseComponent(
    { ...socket, midline: 7, tipY: -3, alarY: -3 },
    { ...shape, section },
  ).fit({
    ...host,
    positions: host.positions.map((p) => p.map((v, i) => v + translation[i])),
  });
  TestValidator.predicate(
    "translated host and datum preserve local section shape",
    translated.constraints.every((pin, i) =>
      pin.target.every((value, axis) =>
        nclose(value, plan.constraints[i].target[axis] + translation[axis]),
      ),
    ),
  );
  TestValidator.equals(
    "neutral section keeps previous component constraints exactly",
    createPortraitNoseComponent(socket, {
      ...shape,
      section: { ...section, influence: 0 },
    }).fit(host).constraints,
    createPortraitNoseComponent(socket, shape).fit(host).constraints,
  );
  const asymmetric = createPortraitNoseComponent(socket, {
    ...shape,
    section: {
      ...section,
      stations: section.stations.map((station) => ({
        ...station,
        depths: [0, 0, 4, 0],
      })),
    },
  }).fit(host);
  // Local X = 0 and 4 give u = 1/2 and 5/6. The Z = -1 mm datum and
  // cubic depth 12*u^2*(1-u) give head-Z values 1/2 and 7/18 mm.
  const asymmetricDepths = [1 / 2, 7 / 18, 7 / 18, 1 / 2];
  TestValidator.predicate(
    "asymmetric section reaches distinct aperture vertices",
    asymmetric.constraints.every(({ vertex, target }) =>
      nclose(target[2], asymmetricDepths[vertex], 1e-8),
    ),
  );
  const asymmetricCage = {
    positions: host.positions.map((p) => [...p]),
    indices: [] as number[],
    groups: [] as number[],
  };
  asymmetric.constraints.forEach(({ vertex, target }) => {
    asymmetricCage.positions[vertex] = [...target];
  });
  asymmetric.attach(asymmetricCage, asymmetricCage.positions, () => 0);
  // The common mean is 4/9 mm. Near-ring scale 0.96 and recession 0.5 mm
  // produce -1/450 and -49/450 mm without independently placing either side.
  TestValidator.predicate(
    "lining preserves that asymmetric shared basis",
    [-1 / 450, -49 / 450, -49 / 450, -1 / 450].every((depth, i) =>
      nclose(asymmetricCage.positions[4 + i][2], depth, 1e-8),
    ),
  );
  for (const sectionAnchor of [undefined, -1, 0.5, 4, NaN])
    TestValidator.predicate(
      "invalid section socket refuses",
      throwsError(
        () =>
          createPortraitNoseComponent(
            { ...socket, sectionAnchor },
            { ...shape, section },
          ).fit(host),
        "socket datum",
      ),
    );
  for (const point of [
    [0, 0],
    [0, 0, NaN],
  ])
    TestValidator.predicate(
      "invalid resident datum refuses",
      throwsError(
        () =>
          createPortraitNoseComponent(socket, { ...shape, section }).fit({
            ...host,
            positions: [point, ...host.positions.slice(1)],
          }),
        "socket datum",
      ),
    );
};
