import { createPortraitNoseComponent } from "@automovie/human/components/nose";
import { applyPortraitRegionReplacements } from "@automovie/human/geometry/portraitRegionReplacement";
import { subdivideControlMesh } from "@automovie/human/geometry/subdivideControlMesh";
import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The real nose component reserves its complete section before refinement.
 *
 * Scenarios:
 * 1. A planar radius-two opening receives a copied rolled envelope. Its actual
 *    deferred appender restores the fixed aperture after two host refinements.
 * 2. Empty/absent profiles retain legacy fitting. Incomplete opening populations
 *    and combinations with legacy rim sections, curve refinement or final body
 *    deformation refuse instead of silently discarding a shape authority.
 */
export const test_subject_nasal_envelope_component = (): void => {
  const host = {
    positions: [
      [2, 0, 0],
      [0, 2, 0],
      [-2, 0, 0],
      [0, -2, 0],
      [5, 0, 0],
      [0, 5, 0],
      [-5, 0, 0],
      [0, -5, 0],
      [0, 0, 0],
    ],
    indices: [] as number[],
    viewRay: [0, 0, 1],
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    host.indices.push(i + 4, j + 4, i, j + 4, j, i, i, j, 8);
  }
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 3],
    nostrils: [[2, 5, 8, 11]],
    sectionAnchor: 8,
  };
  const shape = {
    ...portraitNoseShape,
    widthScale: 1,
    depthScale: 1,
    tipProjection: 0,
    alarProjection: 0,
    lobules: [],
    section: undefined,
    body: undefined,
    rimSection: undefined,
    rimRefinement: "surface" as const,
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilRise: 0,
    nostrilTilt: 0,
    rimRoundness: 0,
    cavityOffset: [0, 0, -2],
    blendReach: 0,
  };
  const profile = {
    segments: 4,
    sections: [{ at: 0, width: 1, crest: 0.3, crestPosition: 0.5, roll: 90 }],
  };
  const component = createPortraitNoseComponent(socket, {
    ...shape,
    envelopes: [profile],
  });
  profile.sections[0].width = 9;
  const plan = component.fit(host),
    removed = new Set(plan.cutFaces),
    targets = new Map(plan.constraints.map((c) => [c.vertex, c.target]));
  TestValidator.equals("copied physical attachment", targets.get(0), [3, 0, 0]);
  const indices = host.indices.filter(
      (_, i) => !removed.has(Math.floor(i / 3)),
    ),
    cage = {
      positions: host.positions.map((p, i) => targets.get(i) ?? [...p]),
      indices,
      groups: new Array<number>(indices.length / 3).fill(0),
    };
  let group = 0;
  const attached = plan.attach(cage, cage.positions, () => ++group);
  TestValidator.equals(
    "one complete deferred envelope",
    attached.replacements?.length,
    1,
  );
  const output = applyPortraitRegionReplacements(
    subdivideControlMesh(cage, 2),
    attached.replacements!,
  );
  TestValidator.predicate(
    "actual consumer retains the aperture",
    output.positions.some((p) => p.every((v, a) => nclose(v, [2, 0, 0][a]))),
  );
  TestValidator.equals(
    "no independent lining finisher",
    attached.finish(output),
    [],
  );
  TestValidator.equals(
    "empty population is legacy",
    createPortraitNoseComponent(socket, { ...shape, envelopes: [] }).fit(host)
      .constraints,
    createPortraitNoseComponent(socket, shape).fit(host).constraints,
  );
  for (const invalid of [
    { envelopes: [profile, profile] },
    { envelopes: [profile], rimSection: { width: 1, crest: 0 } },
    { envelopes: [profile], rimRefinement: "curve" as const },
    {
      envelopes: [profile],
      body: { shape: { lobules: [] }, joinWidth: 1, depthReach: 10 },
    },
  ])
    TestValidator.predicate(
      "one construction owner",
      throwsError(() =>
        createPortraitNoseComponent(socket, { ...shape, ...invalid }),
      ),
    );
};
