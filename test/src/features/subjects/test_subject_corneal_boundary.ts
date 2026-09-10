import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  type IPortraitEyeShape,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The optional limbal boundary belongs to the cornea independently of how much
 * iris the eyelids reveal. An aperture must not reshape that complete boundary.
 *
 * Scenarios:
 * 1. Omission exactly reproduces explicit aperture mode. Limbus mode retains
 *    the full 12.8 mm diameter in both axes under two different lid openings.
 * 2. For one opening, every other named part stays exact, isolating the optical
 *    shell change from lid/iris/skin changes. Unknown boundary modes refuse.
 */
export const test_subject_corneal_boundary = (): void => {
  const shape: IPortraitEyeShape = {
    ...portraitEyeShape,
    cornealBoundary: undefined,
    lidContact: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 4, eyeRows: 2, irisColumns: 12, irisRows: 2 },
  };
  const build = (s: IPortraitEyeShape) =>
    buildPortraitHead(
      referenceControlNet,
      [createPortraitEyeComponent(portraitEyeSockets[0], s)],
      0,
    ).parts;
  const omitted = build(shape),
    explicit = build({ ...shape, cornealBoundary: "aperture" });
  TestValidator.equals(
    "omission preserves the basic optical path",
    omitted,
    explicit,
  );
  for (const openingScale of [0.5, 1.1]) {
    const partial = build({ ...shape, openingScale });
    const full = build({ ...shape, openingScale, cornealBoundary: "limbus" });
    const cornea = full.find((p) => p.id === "right-cornea"),
      clipped = partial.find((p) => p.id === "right-cornea");
    if (cornea?.geometry.type !== "mesh" || clipped?.geometry.type !== "mesh")
      throw new Error("The eye needs resident corneal geometry.");
    const span = (positions: number[], axis: number) => {
      const values = positions.filter((_v, i) => i % 3 === axis);
      return Math.max(...values) - Math.min(...values);
    };
    for (const axis of [0, 1])
      TestValidator.predicate(
        "limbus diameter independent of lid opening",
        nclose(
          span(cornea.geometry.mesh.positions, axis),
          (2 * shape.irisRadius) / 1000,
          1e-10,
        ),
      );
    TestValidator.predicate(
      "aperture mode has a shorter vertical boundary",
      span(clipped.geometry.mesh.positions, 1) < (2 * shape.irisRadius) / 1000,
    );
    TestValidator.equals(
      "other parts keep their geometry",
      full.filter((p) => p.id !== "right-cornea"),
      partial.filter((p) => p.id !== "right-cornea"),
    );
  }
  TestValidator.predicate(
    "unknown optical boundary refuses",
    throwsError(
      () =>
        createPortraitEyeComponent(portraitEyeSockets[0], {
          ...shape,
          cornealBoundary: "unknown" as never,
        }),
      "Corneal boundary",
    ),
  );
};
