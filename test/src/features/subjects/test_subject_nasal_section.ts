import { TestValidator } from "@nestia/e2e";

import { createPortraitNasalSection } from "../../subjects/generated-korean-girl-01/nasalSection";
import { nclose } from "../internal/predicates";

/**
 * A local nasal loft controls a connected surface with independent left/right
 * shape, a common translated datum and a smooth unchanged outer join.
 *
 * Scenarios:
 * 1. Affine control depths reproduce an independent plane oracle. A translated
 *    datum translates that plane, while zero influence and exterior samples
 *    are exact identity. The factory owns all nested authored inputs.
 * 2. Four controls reduce to cubic Bernstein weights. An asymmetric transverse
 *    profile and its mirror match hand-computed values instead of a snapshot.
 * 3. Separate quintic edge transitions give a smooth corner join and remain
 *    bounded near one. A multispan surface stays inside its control-depth hull
 *    and has matching one-sided derivatives through its central knot.
 * 4. Both cubic-minimum and bounded-maximum control populations are accepted.
 */
export const test_subject_nasal_section = (): void => {
  const axis = [-3, -1, 1, 3];
  const plane = {
    transverse: [...axis],
    stations: axis.map((height) => ({
      height,
      depths: axis.map((x) => 2 * x + 3 * height + 5),
    })),
    joinWidth: 1,
    influence: 1,
  };
  const section = createPortraitNasalSection(plane);
  const point = [0.5, -0.25, 2];
  TestValidator.predicate(
    "affine plane survives physical-coordinate inversion",
    nclose(section(point, [0, 0, 0]), 3.25, 1e-8),
  );
  const datum = [7, -3, 11];
  TestValidator.predicate(
    "translation moves one common datum",
    nclose(
      section(
        point.map((v, i) => v + datum[i]),
        datum,
      ),
      3.25,
      1e-8,
    ),
  );
  const neutral = createPortraitNasalSection({ ...plane, influence: 0 });
  TestValidator.equals(
    "zero influence is exact identity",
    neutral(point, [0, 0, 0]),
    0,
  );
  for (const sample of [
    [-3, 0, 2],
    [3, 0, 2],
    [0, -3, 2],
    [0, 3, 2],
    [-4, 0, 2],
    [4, 0, 2],
    [0, -4, 2],
    [0, 4, 2],
  ])
    TestValidator.equals(
      "outer join and exterior are exact",
      section(sample, [0, 0, 0]),
      0,
    );
  plane.transverse[1] = 20;
  plane.stations[1].height = 20;
  plane.stations[1].depths[1] = 200;
  plane.joinWidth = 20;
  plane.influence = 0;
  TestValidator.predicate(
    "constructed loft owns nested inputs",
    nclose(section(point, [0, 0, 0]), 3.25, 1e-8),
  );

  const profile = (depths: number[]) => ({
    transverse: [...axis],
    stations: axis.map((height) => ({ height, depths: [...depths] })),
    joinWidth: 1,
    influence: 1,
  });
  const asymmetric = createPortraitNasalSection(profile([0, 0, 4, 0]));
  const mirrored = createPortraitNasalSection(profile([0, 4, 0, 0]));
  // At X=-1.5 mm, u=1/4. The nonzero Bernstein term is respectively
  // 4*3*u^2*(1-u)=9/16 and 4*3*u*(1-u)^2=27/16.
  TestValidator.predicate(
    "paired shape uses independent Bernstein controls",
    nclose(asymmetric([-1.5, 0, 0], [0, 0, 0]), 9 / 16, 1e-8) &&
      nclose(mirrored([-1.5, 0, 0], [0, 0, 0]), 27 / 16, 1e-8),
  );
  const constant = createPortraitNasalSection(profile([5, 5, 5, 5]));
  TestValidator.predicate(
    "one edge has half influence at its midpoint",
    nclose(constant([-2.5, 0, 1], [0, 0, 0]), 2, 1e-8),
  );
  TestValidator.predicate(
    "corner multiplies the two independent half transitions",
    nclose(constant([-2.5, -2.5, 1], [0, 0, 0]), 1, 1e-8),
  );
  const epsilon = 1e-4;
  TestValidator.predicate(
    "outer value and first derivative tend to zero",
    Math.abs(constant([-3 + epsilon, 0, 0], [0, 0, 0]) / epsilon) < 1e-5,
  );
  const nearPlateau = constant([-3 + 0.999999999999992, 0, 0], [0, 0, 0]);
  TestValidator.predicate(
    "upper-half transition cannot exceed one",
    nearPlateau <= 5 && nearPlateau >= 0,
  );

  const multispan = {
    transverse: [-4, -3, -2, -1, 0, 1, 2, 3, 4],
    stations: [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((height, row) => ({
      height,
      depths: Array.from({ length: 9 }, (_v, column) =>
        (row + column) % 2 === 0 ? -2 : 4,
      ),
    })),
    joinWidth: 0.5,
    influence: 1,
  };
  const surface = createPortraitNasalSection(multispan);
  for (let row = 0; row <= 16; row++)
    for (let column = 0; column <= 16; column++) {
      const value = surface(
        [-3 + (6 * column) / 16, -3 + (6 * row) / 16, 0],
        [0, 0, 0],
      );
      TestValidator.predicate(
        "tensor product has no depth overshoot",
        value >= -2 && value <= 4,
      );
    }
  for (const axisIndex of [0, 1]) {
    const sample = (offset: number) => {
      const p = [0, 0, 0];
      p[axisIndex] = offset;
      return surface(p, [0, 0, 0]);
    };
    const left = (sample(0) - sample(-epsilon)) / epsilon;
    const right = (sample(epsilon) - sample(0)) / epsilon;
    TestValidator.predicate(
      "central spline knot keeps its tangent",
      Math.abs(left - right) < 0.001,
    );
  }
  const maximum = Array.from({ length: 64 }, (_v, i) => i);
  const largest = createPortraitNasalSection({
    transverse: maximum,
    stations: maximum.map((height) => ({
      height,
      depths: maximum.map(() => 7),
    })),
    joinWidth: 1,
    influence: 1,
  });
  TestValidator.predicate(
    "bounded control population is usable",
    nclose(largest([31, 31, 0], [0, 0, 0]), 7),
  );
};
