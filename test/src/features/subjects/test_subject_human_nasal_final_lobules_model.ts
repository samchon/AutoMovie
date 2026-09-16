import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * Full document interpretation carries a local final target into resident skin.
 *
 * Scenarios:
 * 1. With baseline nasal depth edits disabled, a five-mm sphere's pole three mm
 *    above its retained tip datum reaches that hand-authored target in the model.
 */
export const test_subject_human_nasal_final_lobules_model = (): void => {
  const face = coarseHumanFaceFixture("final-nasal-consumer");
  face.basis.recipe.nose = {
    ...face.basis.recipe.nose,
    depthScale: 1,
    tipProjection: 0,
    alarProjection: 0,
    lobules: undefined,
    section: undefined,
    body: undefined,
  };
  const anchor = face.basis.bindings.nose.sectionAnchor!,
    point = face.basis.host.positions[anchor];
  face.detail = {
    nose: {
      body: {
        shape: {
          lobules: [{ anchor, offset: [0, 0, 3], radii: [5, 5, 5], core: 0.8 }],
        },
        joinWidth: 0.1,
        depthReach: 20,
      },
    },
  };
  const model = buildHumanFace(face, 0);
  const matches: number[] = [];
  for (const part of model.parts) {
    if (part.material !== "skin" || part.geometry.type !== "mesh") continue;
    const p = part.geometry.mesh.positions;
    for (let i = 0; i < p.length; i += 3)
      if (nclose(p[i] * 1000, point[0]) && nclose(p[i + 1] * 1000, point[1]))
        matches.push(p[i + 2] * 1000);
  }
  TestValidator.predicate(
    "retained analytic pole is present in actual skin",
    matches.length > 0 && nclose(Math.max(...matches), point[2] + 3),
  );
};
