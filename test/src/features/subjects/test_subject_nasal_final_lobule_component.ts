import { createPortraitNoseComponent } from "@automovie/human/components/nose";
import { applyPortraitFinalSurfaces } from "@automovie/human/geometry/portraitFinalSurface";
import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalSection,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A numerical nose document choice reaches the actual final attachment hook.
 * Local final sections may use a scaled base but never compound pre-fit targets.
 *
 * Scenarios:
 * 1. A flat hand-known host and a five-mm sphere pole leave the fitted cage at
 *    zero, then reach z=5 on final skin while the complete lining stays exact.
 * 2. Profile mutation after component creation is isolated. Empty or absent
 *    local targets retain the baseline, and mixed complete/pre-fit bases refuse.
 */
export const test_subject_nasal_final_lobule_component = (): void => {
  const host = {
    positions: [
      [-1, -1, 0],
      [1, -1, 0],
      [0, 1, 0],
      [0, 0, 0],
      [0, 3, 0],
    ],
    indices: [0, 1, 2, 2, 1, 4],
    viewRay: [0, 0, 1],
  };
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 4],
    nostrils: [[0]],
    sectionAnchor: 3,
    supportPlane: [0, 1, 2],
  };
  const lobule = { anchor: 3, offset: [0, 3, 5], radii: [5, 5, 5], core: 0.8 };
  const base = {
    ...portraitNoseShape,
    widthScale: 1,
    depthScale: 0.8,
    tipProjection: 0,
    alarProjection: 0,
    lobules: undefined,
    section: undefined,
    body: undefined,
    rimSection: undefined,
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilRise: 0,
    nostrilTilt: 0,
    rimRoundness: 0,
    cavityOffset: [0, 0, -2],
  };
  const body = { shape: { lobules: [lobule] }, joinWidth: 1, depthReach: 10 };
  const nose = createPortraitNoseComponent(socket, { ...base, body });
  lobule.offset[2] = 50;
  const plan = nose.fit(host);
  TestValidator.predicate(
    "final target does not deform the fitting cage",
    plan.constraints.every((c) => c.target[2] === 0),
  );
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: [2, 1, 4],
    groups: [0],
  };
  const attached = plan.attach(cage, cage.positions, () => 1);
  if (attached.finalSurface === undefined)
    throw new Error("Expected the real final nasal consumer");
  const result = applyPortraitFinalSurfaces(cage, [
    { id: "nose", propose: attached.finalSurface },
  ]);
  TestValidator.predicate(
    "copied analytic pole reaches final skin",
    nclose(result.positions[4][2], 5),
  );
  for (let i = 0; i < cage.positions.length; i++)
    if (i !== 3 && i !== 4)
      TestValidator.equals(
        "lining and other positions remain exact",
        result.positions[i],
        cage.positions[i],
      );
  TestValidator.predicate(
    "a source datum is not a pinned final position",
    nclose(result.positions[3][2], 4 * 0.2 * (3 - 2 * Math.sqrt(0.2))),
  );
  for (const shape of [
    base,
    { ...base, body: { ...body, shape: { lobules: [] } } },
  ]) {
    const baseline = createPortraitNoseComponent(socket, shape).fit(host);
    TestValidator.equals(
      "absence and empty preserve fitting",
      baseline.constraints,
      plan.constraints,
    );
  }
  for (const alternative of [
    { ...base, body, lobules: [lobule] },
    { ...base, body, section: portraitNasalSection },
    { ...base, body: { ...body, shape: { section: portraitNasalSection } } },
  ])
    TestValidator.predicate(
      "one depth and target authority",
      throwsError(() => createPortraitNoseComponent(socket, alternative)),
    );
};
