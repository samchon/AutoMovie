import {
  portraitNormals,
  portraitRegion,
  sealPortraitContactSeams,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { contactSeamFixture } from "../internal/contactSeamFixture";
import { throwsError } from "../internal/predicates";

/**
 * Contact welds geometry without averaging the pigmentation of two tissues.
 *
 * Scenarios:
 * 1. Red and blue coincident rim vertices retain both corner colours after the
 *    opposed fold is removed; output duplicates share the welded normal.
 * 2. Missing, malformed and out-of-range corner colours refuse at extraction.
 */
export const test_subject_skin_colour_contact = (): void => {
  const mesh = contactSeamFixture();
  mesh.colors = mesh.positions.map((_, i) => (i < 9 ? [1, 0, 0] : [0, 0, 1]));
  const before = structuredClone(mesh),
    sealed = sealPortraitContactSeams(mesh, [6]);
  TestValidator.equals("caller retained", mesh, before);
  TestValidator.equals(
    "one RGB per surviving corner",
    sealed.cornerColors!.length,
    sealed.indices.length,
  );
  const packed = sealed.positions.flat(),
    normals = portraitNormals(packed, sealed.indices);
  const rendered = portraitRegion(
    packed,
    normals,
    sealed.indices,
    sealed.cornerColors,
  );
  const twins = [];
  for (let i = 0; i < rendered.positions.length; i += 3)
    if (
      rendered.positions
        .slice(i, i + 3)
        .every((v, axis) => v === mesh.positions[7][axis])
    )
      twins.push({
        rgb: rendered.colors!.slice(i, i + 3),
        normal: rendered.normals!.slice(i, i + 3),
      });
  TestValidator.equals(
    "both tissue colours survive contact",
    twins.map((t) => t.rgb).sort((a, b) => a[0] - b[0]),
    [
      [0, 0, 1],
      [1, 0, 0],
    ],
  );
  TestValidator.equals("common seam normal", twins[0].normal, twins[1].normal);
  for (const colors of [
    [],
    [[1, 0]],
    [[NaN, 0, 0]],
    [[-0.1, 0, 0]],
    [[1.1, 0, 0]],
  ]) {
    const complete =
      colors.length === 0
        ? []
        : Array.from({ length: sealed.indices.length }, () => colors[0]);
    TestValidator.predicate(
      "invalid corners refuse",
      throwsError(
        () => portraitRegion(packed, normals, sealed.indices, complete),
        "corner colours",
      ),
    );
  }
};
