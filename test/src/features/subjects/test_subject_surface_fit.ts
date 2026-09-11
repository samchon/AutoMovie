import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitSurfaceFit,
  createPortraitSurfaceFitter,
} from "../../subjects/portraitSurfaceFit";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A fitted residual preserves anatomical depth and evaluates its recorded units.
 * Scenarios:
 * 1. Constant and linear affine terms produce independent hand-computed X/Y
 *    displacements; input coordinates and caller-owned coefficients stay intact.
 * 2. At r=0 the radial contribution is zero; at r=2 it is 4 log(2). Malformed
 *    dimensions, coefficients, points and unrepresentable output refuse.
 */
export const test_subject_surface_fit = (): void => {
  const fit: IPortraitSurfaceFit = {
    scale: 10,
    centres: [[0, 0, 0]],
    weights: [[2, -1]],
    affine: [
      [1, 2],
      [3, 0],
      [0, 4],
      [0, 0],
    ],
  };
  const warp = createPortraitSurfaceFitter(fit);
  fit.affine[0][0] = 99;
  const origin = warp([0, 0, 0]);
  TestValidator.equals("zero-radius affine result", origin, [1, 2, 0]);
  const p = [20, 0, 0],
    q = warp(p),
    kernel = 4 * Math.log(2);
  TestValidator.predicate(
    "radial and affine units",
    nclose(q[0], 20 + 1 + 6 + 2 * kernel) &&
      nclose(q[1], 2 - kernel) &&
      q[2] === 0,
  );
  TestValidator.equals("point retained", p, [20, 0, 0]);
  const translated = createPortraitSurfaceFitter({
    scale: 1,
    centres: [],
    weights: [],
    affine: [
      [3, -4],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  });
  TestValidator.equals(
    "depth remains exact",
    translated([1, 2, 7]),
    [4, -2, 7],
  );
  for (const patch of [
    { scale: 0 },
    { scale: NaN },
    { weights: [] },
    { affine: [[0, 0]] },
    { centres: [[0, 0]] },
    { weights: [[Infinity, 0]] },
    { affine: [[0, 0], [0, 0], [0, 0], [0]] },
  ])
    TestValidator.predicate(
      "invalid fit refuses",
      throwsError(
        () => createPortraitSurfaceFitter({ ...fit, ...patch }),
        "aligned",
      ),
    );
  for (const point of [
    [0, 0],
    [NaN, 0, 0],
  ])
    TestValidator.predicate(
      "invalid point refuses",
      throwsError(() => warp(point), "finite XYZ"),
    );
  const huge = createPortraitSurfaceFitter({
    scale: 1,
    centres: [],
    weights: [],
    affine: [
      [Number.MAX_VALUE, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  });
  TestValidator.predicate(
    "overflow refuses",
    throwsError(() => huge([Number.MAX_VALUE, 0, 0]), "representable"),
  );
};
