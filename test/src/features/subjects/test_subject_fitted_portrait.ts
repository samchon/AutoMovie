import {
  createPortraitMaterials,
  portraitNormals,
  portraitPart,
} from "@automovie/human";
import type { IAutoMovieModel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { attachFittedPortraitContext } from "../../subjects/generated-korean-girl-01/fittedModel";
import { throwsError } from "../internal/predicates";

/**
 * The fitted target composes shared anatomical skin with attached optical and
 * coarse context parts. This is a coarse numerical assembly, not a likeness test.
 * Scenarios:
 * 1. Context assembly consumes an in-memory skin and landmarks without rebuilding
 *    a prior, retains unrelated parts and adds resident brows, crowns and hair.
 * 2. A primitive pretending to be the fitted anatomical skin is refused.
 */
export const test_subject_fitted_portrait = (): void => {
  const packed = referenceControlNet.positions.flat();
  const skin = portraitPart(
    "anatomical-skin",
    {
      positions: packed,
      indices: [...referenceControlNet.indices],
      normals: portraitNormals(packed, referenceControlNet.indices),
      uvs: null,
      skin: null,
    },
    "skin",
  );
  const retained = { ...skin, id: "retained-context" };
  const input: IAutoMovieModel = {
    id: "input",
    name: "unit skin",
    origin: "generated",
    parts: [skin, retained],
    materials: createPortraitMaterials(),
    skeleton: null,
    body: null,
    asset: null,
  };
  const primitive = {
    ...skin,
    geometry: {
      type: "primitive",
      shape: { type: "box", width: 1, height: 1, depth: 1 },
    },
  } as const;
  TestValidator.predicate(
    "nonresident skin refuses",
    throwsError(
      () =>
        attachFittedPortraitContext(
          { ...input, parts: [primitive] },
          referenceControlNet.positions,
        ),
      "resident meshes",
    ),
  );
  const model = attachFittedPortraitContext(
      input,
      referenceControlNet.positions,
    ),
    materials = new Set(model.materials.map((m) => m.id));
  TestValidator.equals(
    "context is appended to the supplied model",
    model === input,
    true,
  );
  TestValidator.equals(
    "existing unrelated part remains",
    model.parts.includes(retained),
    true,
  );
  TestValidator.predicate(
    "public selection reaches the anatomical surface",
    model.parts.some((part) => part.id.startsWith("anatomical-")),
  );
  TestValidator.equals(
    "one grouped upper dentition",
    model.parts.filter((p) => p.material === "teeth").map((p) => p.id),
    ["tooth-upper-arch"],
  );
  TestValidator.predicate(
    "complete target attachments",
    model.parts.some((p) => p.id.startsWith("tooth-")) &&
      model.parts.some((p) => p.material === "hair") &&
      model.parts.some((p) => p.id.includes("brow-hair")),
  );
  TestValidator.predicate(
    "resident fitted geometry",
    model.parts.every((p) => {
      const g = p.geometry;
      return (
        materials.has(p.material!) &&
        g.type === "mesh" &&
        g.mesh.positions.every(Number.isFinite) &&
        g.mesh.normals!.every(Number.isFinite)
      );
    }),
  );
};
