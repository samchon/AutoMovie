import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitOcularTissueBoundary,
  createPortraitOcularTissues,
} from "../../subjects/generated-korean-girl-01/ocularTissues";
import { portraitPoint } from "../../subjects/geometry";
import { nclose } from "../internal/predicates";

/**
 * Visible ocular tissue inherits one lid/globe frame with mirrored medial
 * ownership. Analytic parabolic lids supply an independent geometric oracle.
 * Scenarios:
 * 1. Left/right medial regions reflect exactly and face forwards; all boundary
 *    rows touch their supplied lids. Translation follows all three coordinates.
 * 2. A 0.4 mm lower strip follows the live rim, clips to half a narrow aperture,
 *    and remains independent from caruncular/plica dimensions.
 * 3. The plica crest lies lateral to the caruncular mound. Factory inputs are
 *    copied, and zero length/width independently disables each surface.
 */
export const test_subject_ocular_tissues = (): void => {
  const shape = {
    cornerLength: 2,
    caruncleProjection: 0.3,
    plicaProjection: 0.1,
    lowerMarginWidth: 0.4,
    lowerMarginLift: 0,
  };
  const height = (x: number) => 2 * (1 - (x / 10) ** 2);
  const frame: IPortraitOcularTissueBoundary = {
    side: "left",
    minimumX: -10,
    maximumX: 10,
    lower: (x) => portraitPoint(x, -height(x), 12),
    upper: (x) => portraitPoint(x, height(x), 12),
    globe: () => 12,
  };
  const build = createPortraitOcularTissues(shape);
  const left = build(frame),
    right = build({ ...frame, side: "right" });
  const a = left.corner!,
    b = right.corner!;
  // Increasing-X patches have opposite sample order after X reflection. The
  // expected mirror follows the public planar frame, not a captured mesh hash.
  for (let row = 0; row <= 12; row++)
    for (let column = 0; column <= 32; column++) {
      const i = (row * 33 + column) * 3;
      const j = (row * 33 + 32 - column) * 3;
      TestValidator.predicate(
        "paired medial regions mirror",
        [0, 1, 2].every((axis) =>
          nclose(
            a.positions[i + axis],
            b.positions[j + axis] * (axis === 0 ? -1 : 1),
          ),
        ),
      );
      if (row === 0 || row === 12)
        TestValidator.predicate(
          "corner touches the supplied lid",
          nclose(a.positions[i + 2], 12),
        );
    }
  TestValidator.predicate(
    "medial extent",
    nclose(a.positions[0], -10) && nclose(a.positions[32 * 3], -8),
  );
  TestValidator.predicate(
    "outward corner normals",
    a.normals!.every((v, i) => Number.isFinite(v) && (i % 3 !== 2 || v >= 0)),
  );
  const moved = build({
    side: "left",
    minimumX: 1,
    maximumX: 21,
    lower: (x) => portraitPoint(x, -height(x - 11) - 7, 15),
    upper: (x) => portraitPoint(x, height(x - 11) - 7, 15),
    globe: () => 15,
  });
  for (const key of ["corner", "lowerMargin"] as const)
    TestValidator.predicate(
      "tissue follows live frame translation",
      left[key]!.positions.every((v, i) =>
        nclose(moved[key]!.positions[i] - v, [11, -7, 3][i % 3]),
      ),
    );
  const innerMiddle = (4 * 81 + 40) * 3;
  TestValidator.predicate(
    "declared lower margin width",
    nclose(left.lowerMargin!.positions[innerMiddle + 1], -1.6),
  );
  const clipped = createPortraitOcularTissues({
    ...shape,
    lowerMarginWidth: 20,
  })(frame);
  TestValidator.predicate(
    "narrow aperture clips at its middle",
    nclose(clipped.lowerMargin!.positions[innerMiddle + 1], 0),
  );
  const peakX = (caruncleProjection: number, plicaProjection: number) => {
    const mesh = createPortraitOcularTissues({
      ...shape,
      caruncleProjection,
      plicaProjection,
    })(frame).corner!;
    let peak = 0;
    for (let i = 3; i < mesh.positions.length; i += 3)
      if (mesh.positions[i + 2] > mesh.positions[peak + 2]) peak = i;
    return mesh.positions[peak];
  };
  TestValidator.predicate(
    "plica is lateral to caruncle",
    peakX(0, 1) > peakX(1, 0),
  );
  shape.cornerLength = 5;
  shape.lowerMarginWidth = 4;
  TestValidator.equals("factory retains its profile", build(frame), left);
  const noCorner = createPortraitOcularTissues({ ...shape, cornerLength: 0 })(
    frame,
  );
  const noMargin = createPortraitOcularTissues({
    ...shape,
    lowerMarginWidth: 0,
  })(frame);
  TestValidator.equals("corner disables independently", noCorner.corner, null);
  TestValidator.equals(
    "margin disables independently",
    noMargin.lowerMargin,
    null,
  );
  TestValidator.predicate(
    "other surface remains",
    noCorner.lowerMargin !== null && noMargin.corner !== null,
  );
};
