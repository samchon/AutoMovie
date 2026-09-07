import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  appendPortraitNostrils,
  createPortraitNoseComponent,
  portraitCutBoundary,
} from "../../subjects/generated-korean-girl-01/nose";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Nasal orientation rotates the shared aperture and recessed lining together.
 * A lower-facing opening must not leave its cavity pointing at the old camera.
 *
 * Scenarios:
 * 1. A quarter-turn keeps each rim's centre and X coordinates, mapping Y to Z
 *    and Z to negative Y. Vertices outside the cut rims remain unchanged.
 * 2. A simple planar square rotates the cavity offset from [0,3,-5] to [0,5,3],
 *    while retaining the same lining connectivity and material population.
 */
export const test_subject_nostril_frame = (): void => {
  const host = referenceControlNet;
  const base = createPortraitNoseComponent(portraitNoseSocket, {
    ...portraitNoseShape,
    nostrilTilt: 0,
  }).fit(host);
  const turned = createPortraitNoseComponent(portraitNoseSocket, {
    ...portraitNoseShape,
    nostrilTilt: 90,
  }).fit(host);
  const a = new Map(base.constraints.map((c) => [c.vertex, c.target]));
  const b = new Map(turned.constraints.map((c) => [c.vertex, c.target]));
  const boundary = new Set<number>();
  for (const cut of portraitNoseSocket.nostrils) {
    const ids = [
      ...new Set(
        portraitCutBoundary(
          cut.map((i) => host.indices.slice(i * 3, i * 3 + 3)),
        ).flatMap((e) => [e.a, e.b]),
      ),
    ];
    const center = [0, 1, 2].map(
      (axis) => ids.reduce((sum, id) => sum + a.get(id)![axis], 0) / ids.length,
    );
    for (const id of ids) {
      boundary.add(id);
      const original = a.get(id)!,
        rotated = b.get(id)!;
      TestValidator.predicate(
        "rim follows its own centre",
        nclose(rotated[0], original[0]) &&
          nclose(rotated[1] - center[1], -(original[2] - center[2])) &&
          nclose(rotated[2] - center[2], original[1] - center[1]),
      );
    }
  }
  TestValidator.predicate(
    "nasal volume stays independent",
    [...a].every(
      ([id, point]) =>
        boundary.has(id) ||
        point.every((value, axis) => nclose(value, b.get(id)![axis])),
    ),
  );
  const cage = {
    positions: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitNostrils(
    cage,
    [
      [
        [0, 1, 2],
        [0, 2, 3],
      ],
    ],
    {
      ...portraitNoseShape,
      nostrilTilt: 90,
      cavityOffset: [0, 3, -5],
    },
    7,
  );
  TestValidator.predicate(
    "cavity shares the rotated frame",
    cage.positions[cage.positions.length - 1].every((v, i) =>
      nclose(v, [0, 5, 3][i]),
    ),
  );
  TestValidator.equals(
    "supported four-sided lining and floor",
    cage.indices.length,
    60,
  );
  for (const value of [0, 1, NaN])
    TestValidator.predicate(
      "invalid rim support refused",
      throwsError(() =>
        createPortraitNoseComponent(portraitNoseSocket, {
          ...portraitNoseShape,
          rimSupport: value,
        }),
      ),
    );
  for (const value of [-1, 2, NaN])
    TestValidator.predicate(
      "invalid rim roundness refused",
      throwsError(() =>
        createPortraitNoseComponent(portraitNoseSocket, {
          ...portraitNoseShape,
          rimRoundness: value,
        }),
      ),
    );
  TestValidator.predicate(
    "lining region retained",
    cage.groups.every((group) => group === 7),
  );
};
