import { TestValidator } from "@nestia/e2e";

import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import { buildPortraitEye } from "../../subjects/generated-korean-girl-01/eyes";
import { portraitPoint } from "../../subjects/geometry";
import { nclose } from "../internal/predicates";

/**
 * The sclera is a sphere clipped by two curves; its outward normal is radial
 * even at a collapsed canthal row with no nonzero incident triangle area.
 *
 * Scenarios:
 * 1. A radius-two cap gives normal=(position-centre)/2 at every sample.
 * 2. Translating the whole cap preserves its dimensionless normal field and
 *    keeps both collapsed end rows valid rather than emitting zero normals.
 */
export const test_subject_sclera_normals = (): void => {
  for (const offset of [
    [0, 0, 0],
    [3, 4, 5],
  ]) {
    const positions = [
      [-1, 0, Math.sqrt(3)],
      [0, 0.5, Math.sqrt(3.75)],
      [1, 0, Math.sqrt(3)],
      [0, -0.5, Math.sqrt(3.75)],
      [0, 0, 2],
    ].map((point) => point.map((value, axis) => value + offset[axis]));
    const parts = buildPortraitEye(
      positions,
      { positions, indices: [0, 3, 1, 3, 2, 1], groups: [0, 0] },
      new Map([0, 1, 2, 3].map((id) => [id, id])),
      [0, 0, 1],
      {
        name: "left",
        top: [0, 1, 2],
        bottom: [0, 3, 2],
        iris: 4,
        browTop: [0, 1, 2],
        browBottom: [0, 3, 2],
      },
      {
        ...portraitEyeShape,
        surfaceRadius: 2,
        cornealRadius: 1.5,
        cornealThickness: 0.02,
        cornealRimLift: 0.1,
        irisRadius: 0.25,
        pupilRadius: 0.1,
        browFibres: 0,
        upperLashes: 1,
        tissues: undefined,
        sampling: { eyeColumns: 4, eyeRows: 2, irisColumns: 8, irisRows: 2 },
      },
      { center: portraitPoint(offset[0], offset[1], offset[2]), radius: 2 },
    );
    const part = parts.find((part) => part.id === "left-sclera")!;
    if (part.geometry.type !== "mesh")
      throw new Error("Sclera must be resident mesh geometry.");
    const mesh = part.geometry.mesh;
    TestValidator.equals(
      "sampled cap population",
      mesh.positions.length / 3,
      15,
    );
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const normal = mesh.normals!.slice(i, i + 3);
      TestValidator.predicate(
        "unit normal including collapsed canthi",
        nclose(Math.hypot(...normal), 1),
      );
      for (let axis = 0; axis < 3; axis++)
        TestValidator.predicate(
          "radial cap derivative",
          nclose(
            normal[axis],
            (mesh.positions[i + axis] * 1000 - offset[axis]) / 2,
          ),
        );
    }
  }
};
