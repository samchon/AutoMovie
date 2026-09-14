import {
  appendPortraitCranium,
  portraitNeckShape,
} from "@automovie/human/components/cranium";
import { buildPortraitHead } from "@automovie/human/components/head";
import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";

/**
 * Cranial and cervical controls reach the shared assembler, not just a resolver.
 *
 * Scenarios:
 * 1. Explicit planar cap and a changed angular frame affect only appended cranial vertices.
 * 2. A supplied neck crop reaches the assembled mesh while an empty anatomy preserves defaults.
 */
export const test_subject_cranium_replacement = (): void => {
  const make = () => ({
    positions: structuredClone(referenceControlNet.positions),
    indices: [...referenceControlNet.indices],
    groups: referenceControlNet.indices
      .filter((_, i) => i % 3 === 0)
      .map(() => 0),
  });
  const original = make(),
    changed = make();
  appendPortraitCranium(original);
  appendPortraitCranium(changed, {
    capDepth: 0,
    transition: 0.4,
    frame: { width: 75, height: 80, centerY: 3 },
  });
  TestValidator.equals(
    "host identity retained",
    changed.positions.slice(0, referenceControlNet.positions.length),
    referenceControlNet.positions,
  );
  TestValidator.predicate(
    "cranial settings reach vertices",
    JSON.stringify(original.positions) !== JSON.stringify(changed.positions),
  );
  const neck = structuredClone(portraitNeckShape);
  neck.crop.y = -160;
  const built = buildPortraitHead(referenceControlNet, [], 0, [], {
    neck,
    cranium: {},
  });
  TestValidator.equals(
    "custom neck crop reaches head",
    Math.min(...built.refined.positions.map((point) => point[1])),
    -160,
  );
};
