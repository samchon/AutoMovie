import { validateMeshTopology } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import {
  type IPortraitCornea,
  buildPortraitCornea,
} from "../../subjects/portraitCornea";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The anterior optical surface is a closed volumetric mesh with declared
 * curvature and thickness, rather than a highlight painted onto an iris.
 *
 * Scenarios:
 * 1. A hand-defined 3 mm aperture has the analytically derived apex height and
 *    back-rim height; removing one face makes its closed-volume check fail.
 * 2. Clipped extents and one radial ring remain closed. Translating the aperture
 *    and its support field translates every vertex without changing connectivity.
 * 3. Invalid dimensions, extents, sampling and support heights refuse. Each eye
 *    owns the material thickness derived from its own copied shape dimensions.
 */
export const test_subject_cornea = (): void => {
  const input: IPortraitCornea = {
    center: { x: 0, y: 0 },
    radius: 3,
    curvature: 5,
    globeRadius: 10,
    thickness: 0.5,
    rimLift: 0.8,
    extents: [3, 3, 3, 3],
    radialSamples: 2,
    surface: () => 0,
  };
  const mesh = buildPortraitCornea(input),
    z = mesh.positions.filter((_value, i) => i % 3 === 2);
  TestValidator.predicate(
    "analytic corneal sag",
    nclose(Math.max(...z), 0.8 + Math.sqrt(91) - 9),
  );
  TestValidator.predicate(
    "declared back-rim height",
    nclose(Math.min(...z), 0.3),
  );
  TestValidator.equals(
    "closed optical volume",
    validateMeshTopology({ mesh, expectClosed: true }).success,
    true,
  );
  TestValidator.equals(
    "open-volume negative twin",
    validateMeshTopology({
      mesh: { ...mesh, indices: mesh.indices!.slice(3) },
      expectClosed: true,
    }).success,
    false,
  );
  const clipped = buildPortraitCornea({
    ...input,
    extents: [3, 2, 2.5, 1.5],
    radialSamples: 1,
  });
  TestValidator.equals(
    "clipped shell stays closed",
    validateMeshTopology({ mesh: clipped, expectClosed: true }).success,
    true,
  );
  for (const [axis, expected] of [
    [0, [-2.5, 3]],
    [1, [-2, 1.5]],
  ] as const) {
    const values = clipped.positions.filter((_value, i) => i % 3 === axis);
    TestValidator.predicate(
      "clipped aperture extents",
      nclose(Math.min(...values), expected[0]) &&
        nclose(Math.max(...values), expected[1]),
    );
  }
  const moved = buildPortraitCornea({
    ...input,
    center: { x: 2, y: -3 },
    surface: () => 7,
  });
  TestValidator.predicate(
    "support-frame translation",
    mesh.positions.every((value, i) =>
      nclose(moved.positions[i] - value, [2, -3, 7][i % 3]),
    ),
  );
  TestValidator.equals(
    "translation keeps topology",
    moved.indices,
    mesh.indices,
  );
  buildPortraitCornea({ ...input, curvature: input.globeRadius });
  for (const change of [
    { center: { x: NaN, y: 0 } },
    { radius: 0 },
    { curvature: 3 },
    { globeRadius: 4 },
    { thickness: 0 },
    { rimLift: 0.5 },
    { extents: [3, 3] },
    { extents: [0, 3, 3] },
    { extents: [4, 3, 3] },
    { extents: [NaN, 3, 3] },
    { radialSamples: 0 },
    { radialSamples: 1.5 },
    { surface: () => NaN },
  ])
    TestValidator.predicate(
      "invalid optical geometry refused",
      throwsError(() => buildPortraitCornea({ ...input, ...change })),
    );
  const a = createPortraitEyeComponent(portraitEyeSockets[0], portraitEyeShape);
  const shape = { ...portraitEyeShape, cornealThickness: 0.4 };
  const b = createPortraitEyeComponent(portraitEyeSockets[1], shape);
  shape.cornealThickness = 0.2;
  TestValidator.predicate(
    "per-eye metric material thickness",
    nclose(a.materials![0].thickness!, 0.00055) &&
      nclose(b.materials![0].thickness!, 0.0004),
  );
  TestValidator.predicate(
    "paired material identities differ",
    a.materials![0].id !== b.materials![0].id,
  );
  for (const change of [
    { cornealRadius: NaN },
    { cornealRadius: portraitEyeShape.irisRadius },
    { cornealRadius: portraitEyeShape.surfaceRadius + 1 },
    { cornealThickness: 0 },
    { cornealRimLift: portraitEyeShape.cornealThickness + 0.055 },
  ])
    TestValidator.predicate(
      "invalid eye optics refused",
      throwsError(() =>
        createPortraitEyeComponent(portraitEyeSockets[0], {
          ...portraitEyeShape,
          ...change,
        }),
      ),
    );
};
