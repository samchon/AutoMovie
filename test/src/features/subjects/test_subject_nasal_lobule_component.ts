import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalSection,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The local lobule and aperture use one depth calculation before shared lining.
 *
 * Scenarios:
 * 1. Three points at radius three on a radius-five anterior sphere all reach
 *    z=4. A zero-roundness/unit-scale aperture keeps that same computed rim.
 *    Its lining descends from z=4 and keeps original shared vertex identities.
 * 2. Omitted/empty profiles retain z=0; copied profile mutation cannot change
 *    the component. A complete section/body cannot double-own active lobules.
 */
export const test_subject_nasal_lobule_component = (): void => {
  const host = {
    positions: [
      [-3, 0, 0],
      [3, 0, 0],
      [0, 3, 0],
      [0, 0, 0],
    ],
    indices: [0, 1, 2],
    viewRay: [0, 0, 1],
  };
  const socket = { ...portraitNoseSocket, surface: [0, 1, 2], nostrils: [[0]] };
  const lobule = { anchor: 3, offset: [0, 0, 5], radii: [5, 5, 5], core: 0.8 };
  const shape = {
    ...portraitNoseShape,
    depthScale: 1,
    rimSection: undefined,
    lobules: [lobule],
    nostrilWidthScale: 1,
    nostrilHeightScale: 1,
    nostrilTilt: 0,
    rimRoundness: 0,
    cavityOffset: [0, 0, -2],
  };
  const component = createPortraitNoseComponent(socket, shape);
  const plan = component.fit(host);
  TestValidator.predicate(
    "shared aperture depth",
    plan.constraints.every((c) => nclose(c.target[2], 4)),
  );
  const positions = host.positions.map((p) => [...p]);
  for (const c of plan.constraints) positions[c.vertex] = [...c.target];
  const cage = { positions, indices: [] as number[], groups: [] as number[] };
  plan.attach(cage, positions, () => 0);
  TestValidator.predicate(
    "actual shared rim retained",
    cage.positions.slice(0, 3).every((p) => nclose(p[2], 4)),
  );
  TestValidator.predicate(
    "floor follows shaped rim",
    nclose(cage.positions.at(-1)![2], 2),
  );
  TestValidator.equals(
    "lining uses original rim identities",
    cage.indices.slice(0, 3),
    [0, 1, 4],
  );
  lobule.offset[2] = 50;
  TestValidator.equals(
    "component owns lobules",
    component.fit(host).constraints,
    plan.constraints,
  );
  for (const lobules of [undefined, []]) {
    const basic = createPortraitNoseComponent(socket, {
      ...shape,
      lobules,
    }).fit(host);
    TestValidator.predicate(
      "basic identity",
      basic.constraints.every((c) => c.target[2] === 0),
    );
  }
  for (const alternative of [
    { section: portraitNasalSection },
    {
      body: {
        shape: { section: portraitNasalSection },
        joinWidth: 2,
        depthReach: 20,
      },
    },
  ])
    TestValidator.predicate(
      "single section authority",
      throwsError(() =>
        createPortraitNoseComponent(socket, { ...shape, ...alternative }),
      ),
    );
};
