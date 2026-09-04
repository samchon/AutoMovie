import {
  IAutoMovieCurrentSubjectReviewObservation,
  IAutoMovieSubjectReviewCurrentContext,
  foldAutoMovieSubjectReviewCoverage,
  resolveAutoMovieSubjectReviewUnit,
} from "@automovie/engine";
import { IAutoMovieSubjectReviewViewpoint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { subjectInspectionArtifact } from "../internal/subjectInspectionFixtures";

const viewpoint = (
  id: string,
  overrides: Partial<IAutoMovieSubjectReviewViewpoint> = {},
): IAutoMovieSubjectReviewViewpoint => ({
  id,
  direction: { x: 0, y: 0, z: 1 },
  distance: 3,
  projection: "perspective",
  pose: null,
  state: null,
  ...overrides,
});

const observation = (
  viewpointId: string,
  overrides: Partial<IAutoMovieCurrentSubjectReviewObservation> = {},
): IAutoMovieCurrentSubjectReviewObservation => ({
  kind: "subject-view",
  subject: "element:castle/solar-oriel",
  revision: "sha256:inspection-a",
  viewpoint: viewpointId,
  artifact: `renders/solar-oriel/${viewpointId}.png`,
  digest: `sha256:${viewpointId}`,
  productionId: "fixture-film",
  target: {
    shot: "inspection-shot",
    subject: "element:castle/solar-oriel",
  },
  compileFingerprint: `sha256:${"a".repeat(64)}`,
  planIdentity: `sha256:${"b".repeat(64)}`,
  captureRuntimeIdentity: '{"runtime":"current"}',
  verdict: "passed",
  ...overrides,
});

/**
 * Subject coverage counts only current inspection-owned viewpoint receipts.
 *
 * Scenarios:
 *
 * 1. A complete plan preserves plan order, counts one current receipt per
 *    viewpoint, reports duplicates and unplanned views separately, and remains
 *    reviewed when an older receipt for an already-current view also exists.
 * 2. One current view is partial, only old-revision views are stale, no views
 *    are not-run, and an empty plan is indeterminate rather than vacuously
 *    complete.
 * 3. A frame receipt, another subject, malformed records, and an unplanned old
 *    receipt are foreign evidence and cannot satisfy the subject denominator.
 * 4. Blank or duplicate ids, non-positive or non-finite distance, and a
 *    non-unit or non-finite direction are refused before coverage is folded.
 * 5. Compile, plan, runtime and terminal-status twins never become current
 *    merely because their subject revision and viewpoint still match.
 */
export const test_inspection_subject_review_coverage = (): void => {
  const unit = resolveAutoMovieSubjectReviewUnit(subjectInspectionArtifact(), {
    shot: "inspection-shot",
    subject: "element:castle/solar-oriel",
  });
  const plan = [viewpoint("front"), viewpoint("back")];
  const current: IAutoMovieSubjectReviewCurrentContext = {
    productionId: "fixture-film",
    target: unit.target,
    revision: unit.description.revision,
    compileFingerprint: `sha256:${"a".repeat(64)}`,
    planIdentity: `sha256:${"b".repeat(64)}`,
    captureRuntimeIdentity: '{"runtime":"current"}',
  };
  const complete = foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
    observation("back"),
    observation("front"),
    observation("front"),
    observation("front", { revision: "sha256:inspection-old" }),
    observation("detail-z"),
    observation("detail-a"),
  ]);
  TestValidator.equals(
    "coverage admits only the exact current compile, plan, runtime and passed verdict",
    {
      compile: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        observation("front", {
          compileFingerprint: `sha256:${"c".repeat(64)}`,
        }),
      ]),
      plan: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        observation("front", {
          planIdentity: `sha256:${"c".repeat(64)}`,
        }),
      ]),
      runtime: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        observation("front", {
          captureRuntimeIdentity: '{"runtime":"old"}',
        }),
      ]),
      notPassed: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        { ...observation("front"), verdict: "not-run" },
      ]),
    },
    {
      compile: {
        state: "stale",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: ["front"],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      plan: {
        state: "stale",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: ["front"],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      runtime: {
        state: "stale",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: ["front"],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      notPassed: {
        state: "not-run",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: [],
        unplanned: [],
        foreign: 1,
        duplicates: 0,
      },
    },
  );

  TestValidator.equals(
    "complete coverage preserves plan order without duplicate inflation",
    complete,
    {
      state: "reviewed",
      planned: ["front", "back"],
      observed: ["front", "back"],
      missing: [],
      stale: [],
      unplanned: ["detail-a", "detail-z"],
      foreign: 0,
      duplicates: 1,
    },
  );

  TestValidator.equals(
    "execution states follow the actual current viewpoint numerator",
    {
      partial: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        observation("back"),
      ]),
      stale: foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
        observation("front", { revision: "sha256:inspection-old" }),
      ]),
      notRun: foldAutoMovieSubjectReviewCoverage(unit, current, plan, []),
      indeterminate: foldAutoMovieSubjectReviewCoverage(
        unit,
        current,
        [],
        [observation("front")],
      ),
    },
    {
      partial: {
        state: "partial",
        planned: ["front", "back"],
        observed: ["back"],
        missing: ["front"],
        stale: [],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      stale: {
        state: "stale",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: ["front"],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      notRun: {
        state: "not-run",
        planned: ["front", "back"],
        observed: [],
        missing: ["front", "back"],
        stale: [],
        unplanned: [],
        foreign: 0,
        duplicates: 0,
      },
      indeterminate: {
        state: "indeterminate",
        planned: [],
        observed: [],
        missing: [],
        stale: [],
        unplanned: ["front"],
        foreign: 0,
        duplicates: 0,
      },
    },
  );

  const foreign = foldAutoMovieSubjectReviewCoverage(unit, current, plan, [
    {
      kind: "frame",
      shot: "inspection-shot",
      frame: 0,
      digest: "sha256:frame",
    },
    observation("front", { subject: "element:castle/other" }),
    observation("outside", { revision: "sha256:inspection-old" }),
    null,
    "subject-view",
    [],
    {},
    { kind: "subject-view" },
    { ...observation("front"), subject: 7 },
    { ...observation("front"), subject: " " },
    { ...observation("front"), revision: " " },
    { ...observation("front"), viewpoint: " " },
    { ...observation("front"), artifact: " " },
    { ...observation("front"), digest: " " },
  ]);
  TestValidator.equals(
    "frame and malformed evidence never satisfy subject coverage",
    foreign,
    {
      state: "not-run",
      planned: ["front", "back"],
      observed: [],
      missing: ["front", "back"],
      stale: [],
      unplanned: [],
      foreign: 14,
      duplicates: 0,
    },
  );

  TestValidator.equals(
    "invalid viewpoint plans are refused at every numeric and identity boundary",
    namedFacts([
      [
        "blankId",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [viewpoint(" ")],
                [],
              ),
            "must not be blank",
          ),
      ],
      [
        "duplicateId",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [viewpoint("front"), viewpoint("front")],
                [],
              ),
            "duplicated",
          ),
      ],
      [
        "zeroDistance",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [viewpoint("front", { distance: 0 })],
                [],
              ),
            "finite and positive",
          ),
      ],
      [
        "infiniteDistance",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [viewpoint("front", { distance: Number.POSITIVE_INFINITY })],
                [],
              ),
            "finite and positive",
          ),
      ],
      [
        "nonUnitDirection",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [viewpoint("front", { direction: { x: 0, y: 0, z: 2 } })],
                [],
              ),
            "finite unit vector",
          ),
      ],
      [
        "nonFiniteDirection",
        () =>
          throwsError(
            () =>
              foldAutoMovieSubjectReviewCoverage(
                unit,
                current,
                [
                  viewpoint("front", {
                    direction: { x: Number.NaN, y: 0, z: 1 },
                  }),
                ],
                [],
              ),
            "finite unit vector",
          ),
      ],
    ]),
    {
      blankId: true,
      duplicateId: true,
      zeroDistance: true,
      infiniteDistance: true,
      nonUnitDirection: true,
      nonFiniteDirection: true,
    },
  );
};
