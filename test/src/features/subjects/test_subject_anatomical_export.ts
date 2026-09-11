import { TestValidator } from "@nestia/e2e";

import { portraitMeshBuffers } from "../../subjects/portraitMeshBuffers";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../subjects/reference-anatomy/model";
import { nclose } from "../internal/predicates";

/**
 * The anatomical prior's connected skin and lips reach the real Float32
 * buffer consumer with valid normals. Its independent optical surfaces are
 * covered by anatomical_optical_export, so both populations remain complete
 * without a single expensive whole-model export exceeding the unit budget.
 *
 * Scenarios:
 * 1. Pack every skin/lip part of the unrefined prior through the same buffer
 *    owner used by portraitDocument; all directions remain unit after Float32
 *    quantization. Full scene/topology validation is not the normal oracle.
 * 2. Zero, nonunit and nonfinite vectors are negative twins for the same
 *    predicate. Aggregate per accessor to avoid one assertion object per vertex.
 *    The separate gltf_normals scenario pins the binary round trip with an
 *    independent diagonal-vector oracle; it need not repeat this full prior.
 */
export const test_subject_anatomical_export = (): void => {
  const unit = (normals: ArrayLike<number>): boolean => {
    for (let i = 0; i < normals.length; i += 3)
      if (
        !nclose(Math.hypot(normals[i], normals[i + 1], normals[i + 2]), 1, 1e-7)
      )
        return false;
    return true;
  };
  for (const normals of [
    [0, 0, 0],
    [2, 0, 0],
    [NaN, 0, 1],
  ])
    TestValidator.equals("nonunit twin refuses", unit(normals), false);
  TestValidator.equals("unit control admitted", unit([0, 0, 1]), true);
  const model = buildAnatomicalStudy({
    ...anatomicalStudyShape,
    subdivisionRounds: 0,
  });
  model.parts = model.parts.filter(
    (part) => part.material === "skin" || part.material === "lips",
  );
  TestValidator.predicate("surface population exists", model.parts.length > 0);
  for (const part of model.parts) {
    if (part.geometry.type !== "mesh")
      throw new Error("The prior must supply resident surface meshes.");
    const buffers = portraitMeshBuffers(part.geometry.mesh);
    TestValidator.predicate("delivered unit NORMAL", unit(buffers.normals!));
  }
};
