import { resolvePortraitEyeInputs } from "@automovie/human/components/eyeComponentInputs";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { throwsError } from "../internal/predicates";

/**
 * Anatomical input admission is testable without building a host or optical mesh.
 * Every rejected scalar has the same otherwise-valid profile as its valid twin.
 *
 * Scenarios:
 * 1. Positive lengths, nonnegative offsets, signed displacements and sampling
 *    counts reject nonfinite or out-of-range values before host fitting.
 * 2. Optical containment and contact/frame compatibility reject one-field
 *    contradictions while admitting their adjacent valid profile.
 * 3. Pretarsal dimensions and all seven weights retain their own boundaries.
 * 4. Copied socket and sampling inputs do not alias the caller's arrays/object.
 */
export const test_subject_eye_input_admission = (): void => {
  const socket = structuredClone(portraitEyeSockets[0]);
  const valid = structuredClone(portraitEyeShape);
  const admit = (change: Record<string, unknown> = {}) =>
    resolvePortraitEyeInputs(socket, { ...valid, ...change });
  const refuse = (change: Record<string, unknown>) => {
    TestValidator.predicate(
      "changed input refuses",
      throwsError(() => admit(change)),
    );
    TestValidator.equals(
      "unchanged adjacent input admitted",
      admit().shape.widthScale,
      valid.widthScale,
    );
  };
  for (const key of [
    "widthScale",
    "openingScale",
    "irisRadius",
    "pupilRadius",
    "surfaceRadius",
    "cornealRadius",
    "cornealThickness",
    "cornealRimLift",
  ])
    for (const value of [0, NaN]) refuse({ [key]: value });
  for (const key of [
    "blendReach",
    "foldWidth",
    "foldDepth",
    "upperLidVolume",
    "lowerLidWidth",
    "lowerLidVolume",
    "lidThickness",
  ]) {
    for (const value of [-Number.EPSILON, NaN]) refuse({ [key]: value });
    TestValidator.equals(
      "zero nonnegative dimension admitted",
      Reflect.get(admit({ [key]: 0 }).shape, key),
      0,
    );
  }
  for (const key of ["socketLift", "globeLift", "outerCornerLift"]) {
    refuse({ [key]: NaN });
    TestValidator.equals(
      "zero signed offset admitted",
      Reflect.get(admit({ [key]: 0 }).shape, key),
      0,
    );
  }
  for (const value of [0, 1.5, NaN]) refuse({ upperLashes: value });
  for (const key of ["eyeColumns", "eyeRows", "irisColumns", "irisRows"])
    refuse({ sampling: { ...valid.sampling, [key]: 0 } });
  refuse({ sampling: { ...valid.sampling, eyeColumns: 1 } });
  refuse({ sampling: { ...valid.sampling, irisColumns: 2 } });
  for (const change of [
    { pupilRadius: valid.irisRadius },
    { cornealRadius: valid.irisRadius },
    { cornealRadius: valid.surfaceRadius + 1 },
    { cornealRimLift: valid.cornealThickness + 0.055 },
    { sphereFit: "invalid" },
    { opticalFrame: "invalid" },
    { opticalFrame: "radial", cornealBoundary: "aperture" },
    { opticalFrame: "radial", lidContact: "globe" },
    { cornealBoundary: "invalid", lidContact: "globe" },
    { lidContact: "invalid" },
    { lidContact: "cornea", cornealBoundary: "aperture" },
    { skinAttachment: "invalid" },
    { skinBridge: "invalid" },
    { skinBridge: "sampled", skinAttachment: undefined },
    { lidContactReach: -Number.EPSILON },
    { lidContactReach: NaN },
  ])
    refuse(change);
  TestValidator.equals(
    "zero contact reach admitted",
    admit({ lidContactReach: 0 }).shape.lidContactReach,
    0,
  );
  const roll = {
    offset: 1,
    projection: 0,
    width: 4,
    height: 2,
    reach: 8,
    weights: [0, 1, 0, 1, 0, 1, 0],
  };
  TestValidator.equals(
    "weight boundaries admitted",
    admit({ aegyoSal: roll }).shape.aegyoSal?.weights,
    roll.weights,
  );
  for (const key of ["offset", "width", "height", "reach"])
    refuse({ aegyoSal: { ...roll, [key]: 0 } });
  for (const value of [-Number.EPSILON, NaN])
    refuse({ aegyoSal: { ...roll, projection: value } });
  for (const weights of [
    [],
    [1],
    [...roll.weights, 1],
    [NaN, 1, 1, 1, 1, 1, 1],
    [-1, 1, 1, 1, 1, 1, 1],
    [2, 1, 1, 1, 1, 1, 1],
  ])
    refuse({ aegyoSal: { ...roll, weights } });
  const owned = admit();
  const first = owned.socket.top[0],
    columns = owned.shape.sampling.eyeColumns;
  socket.top[0] = -1;
  valid.sampling.eyeColumns = 0;
  TestValidator.equals("owned aperture binding", owned.socket.top[0], first);
  TestValidator.equals(
    "owned sampling",
    owned.shape.sampling.eyeColumns,
    columns,
  );
};
