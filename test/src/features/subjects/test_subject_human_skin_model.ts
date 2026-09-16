import {
  applyPortraitSurfaceLayers,
  createPortraitSkinLayer,
  resolveHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Resolved document skin reaches the shared surface used by model assembly.
 * Optical parts and pinnae have independent construction scenarios; this unit
 * exercises the document-to-tissue path without building those unrelated parts.
 *
 * Scenarios:
 * 1. A small infraorbital pad moves resident skin without adding vertices,
 *    triangles or material groups. Zero condition is an exact negative twin.
 * 2. Resolving and applying the condition preserve caller document and cage.
 */
export const test_subject_human_skin_model = (): void => {
  const document = humanFaceFixture("skin-consumer");
  document.detail = {
    skin: {
      laxity: 1,
      wrinkleDepth: 0,
      wrinkleWidth: 3,
      cheekSag: 0,
      jowlSag: 0,
      volumeLoss: 0,
      underEyeBag: 0.05,
    },
  };
  const before = structuredClone(document),
    face = resolveHumanFaceDocument(document),
    cage = {
      positions: face.host.positions.map((p) => [...p]),
      indices: [...face.host.indices],
      groups: face.host.indices.filter((_, i) => i % 3 === 0).map(() => 0),
    },
    original = structuredClone(cage),
    layer = createPortraitSkinLayer(
      face.bindings,
      face.recipe.skin!,
      face.expression,
    ),
    changed = applyPortraitSurfaceLayers(cage, [layer]);
  TestValidator.predicate(
    "actual resident skin moves",
    changed.positions.some((p, i) =>
      p.some((v, a) => v !== cage.positions[i][a]),
    ),
  );
  TestValidator.equals(
    "no new vertices",
    changed.positions.length,
    cage.positions.length,
  );
  TestValidator.equals("same triangles", changed.indices, cage.indices);
  TestValidator.equals("same material regions", changed.groups, cage.groups);
  TestValidator.equals(
    "zero condition is exact identity",
    applyPortraitSurfaceLayers(cage, [
      createPortraitSkinLayer(face.bindings, {
        ...face.recipe.skin,
        laxity: 0,
        expressionCreasing: 0,
      }),
    ]),
    cage,
  );
  TestValidator.equals("caller cage unchanged", cage, original);
  TestValidator.equals("caller document unchanged", document, before);
};
