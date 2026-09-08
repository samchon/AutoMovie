import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { nclose } from "../internal/predicates";

/**
 * The nasal component preserves its fitted aperture while adding exterior skin.
 *
 * Scenarios:
 * 1. A radius-two square aperture gets an outer attachment one mm along its
 *    retained skin tangent. Newly allocated aperture IDs also own refinement.
 *    The complete skin/band/lining remains closed through actual subdivision.
 * 2. Omission retains direct attachment, while the component owns supplied
 *    section values against later mutation. This checks the real consumer.
 */
export const test_subject_nasal_rim_section_component = (): void => {
  const host = {
    positions: [
      [2, 0, 0],
      [0, 2, 0],
      [-2, 0, 0],
      [0, -2, 0],
      [0, 0, 3],
      [0, 0, -3],
    ],
    indices: [
      4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3,
    ],
    viewRay: [0, 0, 1],
  };
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 3],
    nostrils: [[4, 5, 6, 7]],
  };
  const rimSection = { width: 1, crest: 0.3 };
  const shape = {
    ...portraitNoseShape,
    depthScale: 1,
    lobules: undefined,
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilTilt: 0,
    rimRoundness: 0,
    rimRefinement: "curve" as const,
    rimSection,
    cavityOffset: [0, 0, -2],
  };
  const component = createPortraitNoseComponent(socket, shape);
  const plan = component.fit(host);
  rimSection.width = 20;
  TestValidator.equals(
    "owned section",
    component.fit(host).constraints,
    plan.constraints,
  );
  TestValidator.predicate(
    "outer attachment follows physical skin width",
    plan.constraints.every((c) =>
      nclose(
        Math.hypot(...c.target.map((v, i) => v - host.positions[c.vertex][i])),
        1,
      ),
    ),
  );
  const positions = host.positions.map((p) => [...p]);
  for (const c of plan.constraints) positions[c.vertex] = [...c.target];
  const cage = {
    positions,
    indices: host.indices.slice(0, 12),
    groups: [0, 0, 0, 0],
  };
  let group = 0;
  const attached = plan.attach(cage, positions, () => ++group);
  TestValidator.predicate(
    "new aperture identities",
    attached.curves!.length === 1 &&
      attached.curves![0].every((id) => id >= host.positions.length),
  );
  TestValidator.predicate(
    "fitted aperture unchanged",
    attached.curves![0].every(
      (id) =>
        nclose(Math.hypot(...cage.positions[id]), 2) &&
        cage.positions[id][2] === 0,
    ),
  );
  TestValidator.equals(
    "outer band population",
    cage.groups.filter((g) => g === 2).length,
    16,
  );
  TestValidator.equals(
    "interior population",
    cage.groups.filter((g) => g === 1).length,
    20,
  );
  assertPortraitSkinTopology(cage, []);
  const refined = subdivideControlMesh(cage, 1, attached.curves);
  assertPortraitSkinTopology(refined, []);
  const basic = createPortraitNoseComponent(socket, {
    ...shape,
    rimSection: undefined,
  }).fit(host);
  TestValidator.predicate(
    "omitted section retains radius",
    basic.constraints.every((c) => nclose(Math.hypot(...c.target), 2)),
  );
};
