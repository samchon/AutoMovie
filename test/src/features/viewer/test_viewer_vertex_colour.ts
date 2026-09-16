import { buildModel } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * One material identity may serve both RGB-bearing and bare geometry without
 * enabling a missing attribute or losing the authored modulation.
 *
 * Scenarios:
 * 1. Both variants upload their own attributes and share only equal variants.
 * 2. Null and missing material identities keep the existing fallback, with the
 *    correct colour switch; primitive geometry remains uncoloured.
 */
export const test_viewer_vertex_colour = (): void => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const model = vertexColourModel([
    colored,
    bare,
    colored,
    bare,
    colored,
    bare,
  ]);
  model.parts[4]!.material = null;
  model.parts[5]!.material = "absent";
  model.parts.push({
    ...model.parts[0]!,
    id: "primitive",
    geometry: {
      type: "primitive",
      shape: { type: "box", width: 1, height: 1, depth: 1 },
    },
  });
  const built = buildModel(model);
  const parts = [...built.parts.values()] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >[];
  TestValidator.equals(
    "variant flags",
    parts.map((p) => p.material.vertexColors),
    [true, false, true, false, true, false, false],
  );
  TestValidator.equals(
    "uploaded linear RGB",
    Array.from(parts[0]!.geometry.getAttribute("color").array),
    colored.colors,
  );
  TestValidator.predicate(
    "bare has no colour allocation",
    !parts[1]!.geometry.hasAttribute("color"),
  );
  TestValidator.predicate(
    "variants share within their own kind",
    parts[0]!.material === parts[2]!.material &&
      parts[1]!.material === parts[3]!.material &&
      parts[0]!.material !== parts[1]!.material &&
      parts[6]!.material === parts[1]!.material,
  );
  TestValidator.equals(
    "base colour is not pre-multiplied",
    parts[0]!.material.color.toArray(),
    parts[1]!.material.color.toArray(),
  );
  for (const part of parts) part.geometry.dispose();
  for (const mat of new Set(parts.map((p) => p.material))) mat.dispose();
};
