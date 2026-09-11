import { TestValidator } from "@nestia/e2e";

import { portraitNasalLayerFor } from "../../subjects/generated-korean-girl-01/anatomy";
import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { nclose } from "../internal/predicates";

/**
 * A coupled nasal layer reaches the assembled skin and its attached lining.
 * Arithmetic at a free-standing probe cannot establish this consumer path.
 *
 * Scenarios:
 * 1. A 0.2 mm central control reaches its actual refined vertex, retains the
 *    original connectivity and changes a nonempty attached lining population.
 * 2. An explicit zero control is the unchanged assembly; a remote chin vertex
 *    remains exact under the positive edit, proving its bounded spatial scope.
 */
export const test_subject_nasal_control_assembly = (): void => {
  const nose = createPortraitNoseComponent(
    portraitNoseSocket,
    portraitNoseShape,
  );
  const baseline = buildPortraitHead(referenceControlNet, [nose], 1);
  const controls = [
    { name: "tip", anchor: 4, offset: [0, 0, 0], displacement: [0, 0, 0.2] },
  ];
  const changed = buildPortraitHead(referenceControlNet, [nose], 1, [
    portraitNasalLayerFor({ radius: 22, controls }),
  ]);
  TestValidator.predicate(
    "assembled tip reaches requested movement",
    nclose(
      changed.refined.positions[4][2] - baseline.refined.positions[4][2],
      0.2,
      1e-8,
    ),
  );
  TestValidator.equals(
    "unchanged topology",
    changed.refined.indices,
    baseline.refined.indices,
  );
  TestValidator.equals(
    "remote chin is unchanged",
    changed.refined.positions[152],
    baseline.refined.positions[152],
  );
  const lining = (head: typeof baseline) => {
    const part = head.parts.find((p) => p.id === "nostril-interiors");
    if (part?.geometry.type !== "mesh")
      throw new Error("The assembled nose needs resident lining.");
    return part.geometry.mesh.positions;
  };
  const before = lining(baseline),
    after = lining(changed);
  TestValidator.predicate(
    "real lining follows the common volume",
    before.length > 0 &&
      before.length === after.length &&
      after.some((value, i) => Math.abs(value - before[i]) > 1e-7),
  );
  const neutral = buildPortraitHead(referenceControlNet, [nose], 1, [
    portraitNasalLayerFor({
      radius: 22,
      controls: [{ ...controls[0], displacement: [0, 0, 0] }],
    }),
  ]);
  TestValidator.equals(
    "neutral is unchanged assembled geometry",
    neutral.refined,
    baseline.refined,
  );
};
