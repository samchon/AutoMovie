import { portraitMeshBuffers } from "@automovie/human";
import { buildPortraitHead } from "@automovie/human/components/head";
import { createPortraitMouthComponent } from "@automovie/human/components/mouth";
import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { throwsError } from "../internal/predicates";

/**
 * Closing the component joins the retained lip rims and omits the collapsed cavity.
 *
 * Scenarios:
 * 1. A paired closed seam survives shared subdivision; all skin remains finite.
 * 2. Performance input is copied and cannot be changed after component creation.
 * 3. Lip-attached crowns refuse performance because maxillary teeth must not move with the lips.
 */
export const test_subject_mouth_performance_component = (): void => {
  const performance = { lipPart: 0, observedLipPart: 10 };
  TestValidator.predicate(
    "moving upper teeth refuse",
    throwsError(() =>
      createPortraitMouthComponent(
        portraitMouthSocket,
        { ...portraitMouthShape, crowns: [{ width: 5, height: 7 }] },
        performance,
      ),
    ),
  );
  const component = createPortraitMouthComponent(
    portraitMouthSocket,
    { ...portraitMouthShape, seamProjection: 3, crowns: [] },
    performance,
  );
  performance.lipPart = -1;
  const head = buildPortraitHead(referenceControlNet, [component], 1);
  TestValidator.predicate(
    "no collapsed oral cavity",
    !head.parts.some((part) => part.id === "oral-cavity"),
  );
  TestValidator.predicate(
    "finite closed lip geometry",
    head.refined.positions.every((point) => point.every(Number.isFinite)),
  );
  for (const part of head.parts)
    if (part.geometry.type === "mesh") portraitMeshBuffers(part.geometry.mesh);
  portraitMouthSocket.upper.forEach((id, i) =>
    TestValidator.equals(
      "subdivided shared seam",
      head.refined.positions[id],
      head.refined.positions[portraitMouthSocket.lower[i]],
    ),
  );
};
