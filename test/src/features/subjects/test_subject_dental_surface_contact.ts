import { measureAutoMovieMeshClearance } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { buildPortraitDentalCrown } from "../../subjects/generated-korean-girl-01/dentalCrown";
import { buildPortraitDentalRow } from "../../subjects/generated-korean-girl-01/dentalRow";
import { throwsError } from "../internal/predicates";

/**
 * Proximal clearance is measured after complete crown shape and arch rotation.
 * Scenarios:
 * 1. Three curved-arch crowns receive a 0.5 mm surface gap while each crown
 *    retains one rigid X translation, its original Y/Z and its normals.
 * 2. Omitted contact retains nominal placement; explicit zero still enforces
 *    nonpenetration. Negative and nonfinite contact-gap requests refuse.
 */
export const test_subject_dental_surface_contact = (): void => {
  const profile = {
    width: 4,
    height: 6,
    depth: 1.5,
    cervicalWidth: 0.8,
    edgeRise: 0.2,
  };
  const shape = {
    halfWidth: 7,
    depth: 5,
    gap: 0,
    crowns: [profile, profile, profile],
  };
  const base = buildPortraitDentalRow(shape),
    placed = buildPortraitDentalRow({ ...shape, contactGap: 0.5 });
  TestValidator.equals(
    "omitted option is identity",
    base,
    buildPortraitDentalRow({ ...shape, contactGap: undefined }),
  );
  const crown = buildPortraitDentalCrown(profile, 1),
    stride = crown.positions.length,
    faces = crown.indices!.length;
  const split = (mesh: typeof base, index: number) => ({
    positions: mesh.positions
      .slice(index * stride, (index + 1) * stride)
      .map((v) => v / 1000),
    indices: mesh
      .indices!.slice(index * faces, (index + 1) * faces)
      .map((id) => id - (index * stride) / 3),
    normals: null,
    uvs: null,
    skin: null,
  });
  let changed = false;
  for (let i = 0; i < 3; i++) {
    const shift = placed.positions[i * stride] - base.positions[i * stride];
    changed ||= Math.abs(shift) > 1e-6;
    for (let v = 0; v < stride; v++)
      TestValidator.predicate(
        "each crown remains rigid",
        Math.abs(
          placed.positions[i * stride + v] -
            base.positions[i * stride + v] -
            (v % 3 === 0 ? shift : 0),
        ) < 1e-10,
      );
  }
  TestValidator.predicate(
    "constraint actually changes this arrangement",
    changed,
  );
  TestValidator.equals(
    "all enamel normals retained",
    placed.normals,
    base.normals,
  );
  TestValidator.equals(
    "unmoved axes retain exact construction bytes",
    placed.positions.filter((_, i) => i % 3 !== 0),
    base.positions.filter((_, i) => i % 3 !== 0),
  );
  for (const [mesh, gap] of [
    [placed, 0.0005],
    [buildPortraitDentalRow({ ...shape, contactGap: 0 }), 0],
  ] as const)
    for (let j = 1; j < 3; j++)
      for (let i = 0; i < j; i++) {
        const measured = measureAutoMovieMeshClearance(
          split(mesh, j),
          split(mesh, i),
          "x",
        );
        TestValidator.predicate(
          "complete proximal separation",
          measured.every((face) => face.minimum >= gap - 1e-12),
        );
      }
  for (const contactGap of [-1, Infinity, NaN])
    TestValidator.predicate(
      "invalid contact gap refuses",
      throwsError(
        () => buildPortraitDentalRow({ ...shape, contactGap }),
        "contact gap",
      ),
    );
};
