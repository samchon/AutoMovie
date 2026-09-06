import type {
  IAutoMovieDiagnostic,
  IAutoMovieLibraryRequiredObservation,
  IAutoMovieLibraryReviewObservationReceipt,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

/** Load the receipt gate from source; the library review consumer calls it. */
const unit = loadSourceModule<{
  libraryObservationReceiptDiagnostics: (props: {
    target: string;
    path: string | null;
    required: readonly IAutoMovieLibraryRequiredObservation[];
    receipts: readonly IAutoMovieLibraryReviewObservationReceipt[];
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
);

const OWNER = "library:main:docs/design/hall.md#hall";

const requirement = (props: {
  id: string;
  role: IAutoMovieLibraryRequiredObservation["role"];
  space: string | null;
}): IAutoMovieLibraryRequiredObservation => ({
  id: props.id,
  role: props.role,
  subject: "space:hall/main",
  building: "hall",
  origin: "topology:hall/main",
  pose:
    props.space === null
      ? null
      : {
          position: { x: 0, y: 1.6, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          target: { x: 0, y: 1.6, z: 4 },
          space: props.space,
        },
});

const receipt = (props: {
  direction?: { x: number; y: number; z: number };
  measurements?: Readonly<Record<string, number>>;
  observation: string;
  position?: { x: number; y: number; z: number };
  space?: string | null;
  target?: { x: number; y: number; z: number };
  verdict?: IAutoMovieLibraryReviewObservationReceipt["verdict"];
}): IAutoMovieLibraryReviewObservationReceipt => ({
  observation: props.observation,
  evidence: {
    kind: "facts",
    facts: {},
    digest: `sha256:${"0".repeat(64)}`,
  },
  identity: {
    design: `sha256:${"1".repeat(64)}`,
    source: `sha256:${"2".repeat(64)}`,
    generated: null,
    plan: `sha256:${"3".repeat(64)}`,
  },
  runtimeIdentity: "test-instrument@1",
  pose:
    props.space === undefined || props.space === null
      ? null
      : {
          position: props.position ?? { x: 0, y: 1.6, z: 0 },
          direction: props.direction ?? { x: 0, y: 0, z: 1 },
          target: props.target ?? { x: 0, y: 1.6, z: 4 },
          space: props.space,
        },
  measurements: props.measurements ?? {},
  verdict: props.verdict ?? "passed",
});

const run = (props: {
  required: readonly IAutoMovieLibraryRequiredObservation[];
  receipts: readonly IAutoMovieLibraryReviewObservationReceipt[];
}): IAutoMovieDiagnostic[] =>
  unit.libraryObservationReceiptDiagnostics({
    target: OWNER,
    path: "docs/design/hall.review.json",
    required: props.required,
    receipts: props.receipts,
  });

/**
 * A receipt must say where it stood, and a threshold must say what it read.
 *
 * The closure gate judges the plan: which observations an owner owes and which
 * it opens. Nothing judged what came back. A receipt named the observation it
 * paid and carried bytes, and never said the bytes were drawn from the place
 * the observation is about -- so an interior view taken from the corridor
 * outside was indistinguishable from one taken inside the room, and being
 * inside the room is the entire claim that observation makes.
 *
 * Scenarios:
 *
 * 1. An interior receipt carrying no pose is refused, and the refusal names the
 *    observation and the subject rather than reporting a count.
 * 2. An interior receipt drawn from a different space than the topology proved
 *    is refused: one room's interior says nothing about its siblings.
 * 3. The same receipt standing in the proved space passes, so the rule is not a
 *    blanket refusal of interior receipts.
 * 4. An exterior receipt with no pose passes, because an exterior frame comes
 *    from the subject's own extent and has no chosen point to report.
 * 5. A passed threshold receipt that read nothing is refused; the same receipt
 *    carrying one measurement passes, and a `not-run` one is left alone because
 *    a threshold nobody opened owes no reading.
 * 6. A receipt for an observation this owner does not require is ignored here
 *    rather than refused twice: the closure gate already owns that failure.
 */
export const test_production_library_observation_receipt = (): void => {
  const interior = requirement({
    id: "interior-center-main",
    role: "interior-center",
    space: "hall/main",
  });
  const threshold = requirement({
    id: "interior-threshold-main",
    role: "interior-threshold",
    space: "hall/main",
  });
  const facade = requirement({
    id: "facade-north",
    role: "facade",
    space: null,
  });

  const poseless = run({
    required: [interior],
    receipts: [receipt({ observation: interior.id })],
  });
  const wrongRoom = run({
    required: [interior],
    receipts: [receipt({ observation: interior.id, space: "hall/annex" })],
  });
  const wrongPose = run({
    required: [interior],
    receipts: [
      receipt({
        observation: interior.id,
        position: { x: 20, y: 1.6, z: 0 },
        space: "hall/main",
      }),
    ],
  });

  TestValidator.equals(
    "a receipt that never says where it stood is refused by name",
    namedFacts([
      ["one refusal, not a count", () => poseless.length === 1],
      [
        "and it names the observation and the subject",
        () =>
          poseless[0]!.message.includes(interior.id) &&
          poseless[0]!.message.includes("space:hall/main"),
      ],
      [
        "the address is the observation inside its owner",
        () => poseless[0]!.target === `${OWNER}:${interior.id}`,
      ],
      // The wrong-room case is the same claim wearing a coordinate: the eye was
      // somewhere, and not where the topology said an eye could stand for this
      // question.
      [
        "a receipt from another room is refused too",
        () => wrongRoom.length === 1,
      ],
      [
        "and the refusal names both spaces",
        () =>
          wrongRoom[0]!.message.includes("hall/annex") &&
          wrongRoom[0]!.message.includes("hall/main"),
      ],
      [
        "aPoseElsewhereInTheNamedRoomIsRefused",
        () =>
          wrongPose.length === 1 &&
          wrongPose[0]!.message.includes("topology-derived camera pose"),
      ],
    ]),
    namedFacts([
      ["one refusal, not a count", () => true],
      ["and it names the observation and the subject", () => true],
      ["the address is the observation inside its owner", () => true],
      ["a receipt from another room is refused too", () => true],
      ["and the refusal names both spaces", () => true],
      ["aPoseElsewhereInTheNamedRoomIsRefused", () => true],
    ]),
  );

  TestValidator.equals(
    "a receipt that stood where the topology proved is accepted",
    {
      // Without this the rule could be "refuse every interior receipt" and
      // both refusals above would still read green.
      proved: run({
        required: [interior],
        receipts: [receipt({ observation: interior.id, space: "hall/main" })],
      }).length,
      // An exterior frame comes from the subject's own extent, so there is no
      // chosen point to report and a null pose is the honest reading.
      exterior: run({
        required: [facade],
        receipts: [receipt({ observation: facade.id })],
      }).length,
      exteriorWithAuthoredEye: run({
        required: [facade],
        receipts: [receipt({ observation: facade.id, space: "hall/main" })],
      }).length,
      // The closure gate owns an observation this owner never required; this
      // one passes over it rather than refusing the same thing twice.
      unrequired: run({
        required: [interior],
        receipts: [
          receipt({ observation: "not-required", space: "hall/main" }),
        ],
      }).length,
    },
    { proved: 0, exterior: 0, exteriorWithAuthoredEye: 1, unrequired: 0 },
  );

  const unmeasured = run({
    required: [threshold],
    receipts: [receipt({ observation: threshold.id, space: "hall/main" })],
  });
  TestValidator.equals(
    "a threshold that passed without reading anything is a picture with a verdict",
    {
      refused: unmeasured.length === 1,
      named:
        unmeasured[0]?.message.includes("without reading a single") ?? false,
      // One reading is enough; the gate asks whether the observation measured,
      // not how much.
      measured: run({
        required: [threshold],
        receipts: [
          receipt({
            measurements: { clearWidthMeters: 0.92 },
            observation: threshold.id,
            space: "hall/main",
          }),
        ],
      }).length,
      // A threshold nobody opened owes no reading, so the verdict decides
      // whether the question is asked at all.
      notRun: run({
        required: [threshold],
        receipts: [
          receipt({
            observation: threshold.id,
            space: "hall/main",
            verdict: "not-run",
          }),
        ],
      }).length,
      invalidMeasurementName: run({
        required: [threshold],
        receipts: [
          receipt({
            measurements: { " ": 0.92 },
            observation: threshold.id,
            space: "hall/main",
          }),
        ],
      }).length,
      specialMeasurementName: run({
        required: [threshold],
        receipts: [
          receipt({
            measurements: Object.fromEntries([["__proto__", 0.92]]),
            observation: threshold.id,
            space: "hall/main",
          }),
        ],
      }).length,
    },
    {
      refused: true,
      named: true,
      measured: 0,
      notRun: 0,
      invalidMeasurementName: 1,
      specialMeasurementName: 0,
    },
  );
};
