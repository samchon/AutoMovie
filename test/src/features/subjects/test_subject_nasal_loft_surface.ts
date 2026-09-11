import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitNasalBodySurface } from "../../subjects/generated-korean-girl-01/nasalBodySurface";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { applyPortraitFinalSurfaces } from "../../subjects/portraitFinalSurface";
import { nclose, throwsError } from "../internal/predicates";

/**
 * An absolute section loft controls final nasal depth through the same shared
 * aperture join as an additive body, without applying both construction bases.
 * Scenarios:
 * 1. A flat Z=2mm loft and a half-weight physical collar move a planar witness
 *    to Z=1mm, independently of a supplied oblique image ray; lining stays exact.
 * 2. Datum translation, an owned pole snapshot and zero influence retain their
 *    declared behavior. Simultaneous pre-fit/final section construction refuses.
 */
export const test_subject_nasal_loft_surface = (): void => {
  const section = {
    transverse: [-4, -2, 2, 4],
    stations: [-4, -2, 2, 4].map((height) => ({
      height,
      depths: [2, 2, 2, 2],
    })),
    joinWidth: 0.5,
    influence: 1,
  };
  const mesh = {
    positions: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
      [0, 0, 0],
      [0, 2, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3, 3, 2, 5],
    groups: [1, 1, 0],
  };
  const propose = createPortraitNasalBodySurface(
    { section },
    4,
    1,
    [1, 0, 1],
    2,
    10,
  );
  const result = applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]);
  TestValidator.predicate(
    "absolute loft uses the head-Z frame",
    nclose(result.positions[5][0], 0) &&
      nclose(result.positions[5][1], 2) &&
      nclose(result.positions[5][2], 1),
  );
  TestValidator.equals(
    "lining coordinates remain owned by the aperture",
    result.positions.slice(0, 4),
    mesh.positions.slice(0, 4),
  );
  section.stations[0].depths[0] = 100;
  TestValidator.equals(
    "final loft owns its pole snapshot",
    applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]),
    result,
  );
  section.stations[0].depths[0] = 2;
  const shift = [5, 6, 7];
  const translated = {
    ...mesh,
    positions: mesh.positions.map((p) => p.map((v, i) => v + shift[i])),
  };
  const moved = applyPortraitFinalSurfaces(translated, [
    { id: "nose", propose },
  ]);
  TestValidator.predicate(
    "loft follows its shared datum",
    moved.positions[5].every((v, i) =>
      nclose(v, result.positions[5][i] + shift[i]),
    ),
  );
  const neutral = createPortraitNasalBodySurface(
    { section: { ...section, influence: 0 } },
    4,
    1,
    [0, 0, 1],
    2,
    10,
  );
  TestValidator.predicate(
    "zero influence retains mesh identity",
    applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose: neutral }]) ===
      mesh,
  );
  TestValidator.predicate(
    "two competing section bases refuse",
    throwsError(
      () =>
        createPortraitNoseComponent(portraitNoseSocket, {
          ...portraitNoseShape,
          section,
          body: { shape: { section }, joinWidth: 2, depthReach: 10 },
        }),
      "one pre-fit or final",
    ),
  );
};
