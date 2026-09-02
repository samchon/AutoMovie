import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

const request = loadSourceModule<{
  readAutoMovieObservationMeasurements: (
    value: string | undefined,
  ) => Record<string, number>;
  readAutoMovieObservationPose: (value: string | undefined) => unknown;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewRequest.ts",
  ),
);

/**
 * Observation pose and measurement arguments are parsed as finite typed data.
 *
 * Scenarios:
 *
 * 1. Omitted values preserve the distinct null-pose and empty-measurement
 *    states.
 * 2. A complete pose and named measurements round-trip without defaults.
 * 3. Malformed JSON, missing vectors, non-finite axes, blank space names, and
 *    non-numeric measurements are refused at the argument boundary.
 */
export const test_cli_scaffold_library_review_request = (): void => {
  const pose = {
    position: { x: 1, y: 1.6, z: 2 },
    direction: { x: 0, y: 0, z: -1 },
    target: { x: 1, y: 1.6, z: 0 },
    space: "hall",
  };
  TestValidator.equals(
    "library observation arguments are typed without repository fixtures",
    namedFacts([
      [
        "omittedPoseIsNull",
        () => request.readAutoMovieObservationPose(undefined) === null,
      ],
      [
        "omittedMeasurementsAreEmpty",
        () =>
          Object.keys(request.readAutoMovieObservationMeasurements(undefined))
            .length === 0,
      ],
      [
        "completePoseRoundTrips",
        () =>
          JSON.stringify(
            request.readAutoMovieObservationPose(JSON.stringify(pose)),
          ) === JSON.stringify(pose),
      ],
      [
        "finiteMeasurementsRoundTrip",
        () =>
          JSON.stringify(
            request.readAutoMovieObservationMeasurements(
              JSON.stringify({ clearWidth: 0.9, clearHeight: 2.1 }),
            ),
          ) === JSON.stringify({ clearWidth: 0.9, clearHeight: 2.1 }),
      ],
      [
        "malformedPoseIsRefused",
        () =>
          throwsError(
            () => request.readAutoMovieObservationPose("{"),
            "--pose must be",
          ),
      ],
      [
        "missingVectorIsRefused",
        () =>
          throwsError(
            () =>
              request.readAutoMovieObservationPose(
                JSON.stringify({ ...pose, position: null }),
              ),
            "--pose position must be",
          ),
      ],
      [
        "nonFiniteAxisIsRefused",
        () =>
          throwsError(
            () =>
              request.readAutoMovieObservationPose(
                JSON.stringify({
                  ...pose,
                  position: { x: 1, y: 1, z: "near" },
                }),
              ),
            "--pose position.z must be",
          ),
      ],
      [
        "blankSpaceIsRefused",
        () =>
          throwsError(
            () =>
              request.readAutoMovieObservationPose(
                JSON.stringify({ ...pose, space: "  " }),
              ),
            "--pose space must be",
          ),
      ],
      [
        "nonNumericMeasurementIsRefused",
        () =>
          throwsError(
            () =>
              request.readAutoMovieObservationMeasurements(
                JSON.stringify({ clearWidth: "wide" }),
              ),
            "--measurements clearWidth must be",
          ),
      ],
      [
        "malformedMeasurementObjectIsRefused",
        () =>
          throwsError(
            () => request.readAutoMovieObservationMeasurements("["),
            "--measurements must be",
          ) &&
          throwsError(
            () => request.readAutoMovieObservationMeasurements("[]"),
            "--measurements must be",
          ),
      ],
      [
        "blankMeasurementNameIsRefused",
        () =>
          throwsError(
            () =>
              request.readAutoMovieObservationMeasurements(
                JSON.stringify({ " ": 1 }),
              ),
            "keys must be nonblank",
          ),
      ],
    ]),
    {
      omittedPoseIsNull: true,
      omittedMeasurementsAreEmpty: true,
      completePoseRoundTrips: true,
      finiteMeasurementsRoundTrip: true,
      malformedPoseIsRefused: true,
      missingVectorIsRefused: true,
      nonFiniteAxisIsRefused: true,
      blankSpaceIsRefused: true,
      nonNumericMeasurementIsRefused: true,
      malformedMeasurementObjectIsRefused: true,
      blankMeasurementNameIsRefused: true,
    },
  );
};
