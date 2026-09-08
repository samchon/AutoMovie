import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import type { IPortraitNasalBodyShape } from "../../subjects/generated-korean-girl-01/nasalBody";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { throwsError } from "../internal/predicates";

/**
 * The optional final nasal body reaches real assembled skin while retaining the
 * independently built lining and the caller-owned shape's creation-time value.
 *
 * Scenarios:
 * 1. A positive central body changes exterior positions but preserves every
 *    lining position and all triangle identities on a one-round shared head.
 * 2. Mutating the supplied body after component creation cannot change the
 *    assembled result. A missing body datum refuses before attachment.
 */
export const test_subject_nasal_body_assembly = (): void => {
  // This scenario isolates the complete final-body basis. Another subject's
  // selected depth-scale basis must not be stacked beneath it.
  const baseShape = { ...portraitNoseShape, depthScale: 1 };
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const fullness: [number, number] = [0, 0];
  const shape: IPortraitNasalBodyShape = {
    stations: [
      { height: -16, centre: 0, shoulder: 0, ala: 0 },
      { height: -4, centre: 1, shoulder: 0, ala: 0 },
      { height: 8, centre: 0, shoulder: 0, ala: 0 },
    ],
    centreWidth: 12,
    shoulderOffset: 4,
    shoulderWidth: 2,
    alarOffset: 15,
    alarWidth: 4,
    fullness,
    spread: [0, 0],
    creaseOffset: 4,
    creaseWidth: 2,
    crease: [0, 0],
  };
  const body = { shape, joinWidth: 8, depthReach: 42 };
  const nose = createPortraitNoseComponent(portraitNoseSocket, {
    ...baseShape,
    body,
  });
  const baseline = buildPortraitHead(
    host,
    [
      createPortraitNoseComponent(portraitNoseSocket, {
        ...baseShape,
        body: undefined,
      }),
    ],
    1,
  );
  const changed = buildPortraitHead(host, [nose], 1);
  TestValidator.predicate(
    "the real final hook changes nasal exterior",
    changed.refined.positions.some((p, i) =>
      p.some((v, a) => Math.abs(v - baseline.refined.positions[i][a]) > 1e-6),
    ),
  );
  TestValidator.equals(
    "final shaping retains shared topology",
    changed.refined.indices,
    baseline.refined.indices,
  );
  const oldLining = baseline.parts.find((p) => p.id === "nostril-interiors")!;
  const newLining = changed.parts.find((p) => p.id === "nostril-interiors")!;
  if (oldLining.geometry.type !== "mesh" || newLining.geometry.type !== "mesh")
    throw new Error("The lining must be a mesh.");
  TestValidator.equals(
    "every lining position stays exact",
    newLining.geometry.mesh.positions,
    oldLining.geometry.mesh.positions,
  );
  shape.stations[1].centre = 100;
  fullness[0] = 3;
  body.joinWidth = 1;
  TestValidator.equals(
    "the nose owns its full body snapshot",
    buildPortraitHead(host, [nose], 1).refined,
    changed.refined,
  );
  TestValidator.predicate(
    "body-only shaping still requires a datum",
    throwsError(
      () =>
        createPortraitNoseComponent(
          { ...portraitNoseSocket, sectionAnchor: undefined },
          { ...baseShape, body },
        ).fit(host),
      "resident finite socket datum",
    ),
  );
};
