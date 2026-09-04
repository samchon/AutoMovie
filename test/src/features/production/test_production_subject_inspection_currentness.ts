import {
  type IAutoMovieCaptureRuntimeIdentity,
  type IAutoMovieSubjectReviewViewpoint,
} from "@automovie/interface";
import {
  AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL,
  type IAutoMovieSubjectInspectionObservationRecord,
  type IAutoMovieSubjectInspectionPlanRecord,
  type IAutoMovieSubjectInspectionPose,
  autoMovieSubjectInspectionPlanIdentity,
  canonicalAutoMovieCaptureRuntimeIdentity,
  canonicalizeAutoMovieJson,
  digestAutoMovieBytes,
  parseAutoMovieCaptureRuntimeIdentity,
  parseAutoMovieSubjectInspectionObservation,
  parseAutoMovieSubjectInspectionPlan,
  verifyAutoMovieSubjectInspectionObservation,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { testCaptureRuntimeIdentity } from "./productionFixtures";

const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}`;

const viewpoint = (
  id: string,
  direction: { x: number; y: number; z: number },
): IAutoMovieSubjectReviewViewpoint => ({
  id,
  direction,
  distance: 3,
  projection: "perspective",
  pose: null,
  state: null,
});

const pose = (x: number): IAutoMovieSubjectInspectionPose => ({
  coordinateSpace: "world",
  position: { x, y: 1, z: 3 },
  target: { x: 0, y: 1, z: 0 },
  fovDeg: 35,
  aspect: 1,
  near: 0.1,
  far: 10,
});

const plan = (): IAutoMovieSubjectInspectionPlanRecord => {
  const context = {
    productionId: "fixture-film",
    target: { shot: "opening", subject: "element:hero" },
    revision: digest("1"),
    compileFingerprint: digest("2"),
    planned: [
      viewpoint("front", { x: 0, y: 0, z: 1 }),
      viewpoint("back", { x: 0, y: 0, z: -1 }),
    ],
    poses: [pose(0), pose(1)],
  };
  return {
    version: 2,
    ...context,
    planIdentity: autoMovieSubjectInspectionPlanIdentity(context),
    deliveryEvidence: false,
  };
};

const observation = (props: {
  plan: IAutoMovieSubjectInspectionPlanRecord;
  runtimeIdentity?: IAutoMovieCaptureRuntimeIdentity;
  pose?: IAutoMovieSubjectInspectionPose;
  compileFingerprint?: `sha256:${string}`;
}): {
  bytes: Uint8Array;
  record: IAutoMovieSubjectInspectionObservationRecord;
} => {
  const bytes = new TextEncoder().encode("current subject pixels");
  const selectedPose =
    props.pose !== undefined ? props.pose : props.plan.poses[0]!;
  const selectedRuntime = props.runtimeIdentity ?? testCaptureRuntimeIdentity();
  const selectedCompile =
    props.compileFingerprint ?? props.plan.compileFingerprint;
  const artifact =
    "automovie/inspections/fixture-film/opening/element%3Ahero/" +
    `${encodeURIComponent(props.plan.planIdentity)}/attempt-1/front.png`;
  return {
    bytes,
    record: {
      version: 2,
      productionId: props.plan.productionId,
      target: props.plan.target,
      revision: props.plan.revision,
      observation: {
        kind: "subject-view",
        productionId: props.plan.productionId,
        target: props.plan.target,
        subject: props.plan.target.subject,
        revision: props.plan.revision,
        compileFingerprint: selectedCompile,
        planIdentity: props.plan.planIdentity,
        viewpoint: "front",
        pose: selectedPose,
        runtimeIdentity: selectedRuntime,
        artifact,
        digest: digestAutoMovieBytes(bytes),
        verdict: "passed",
        deliveryEvidence: false,
      },
      pose: selectedPose,
      compileFingerprint: selectedCompile,
      planIdentity: props.plan.planIdentity,
      attempt: 1,
      viewpoint: "front",
      runtimeIdentity: selectedRuntime,
      verdict: "passed",
      deliveryEvidence: false,
    },
  };
};

const systemChannelRuntime = (): IAutoMovieCaptureRuntimeIdentity => {
  const fixture = testCaptureRuntimeIdentity();
  const closureBasis = {
    protocolVersion: fixture.runtimeClosure.protocolVersion,
    packages: fixture.runtimeClosure.packages,
    browserSupport: {
      status: "system-channel-unsealed" as const,
      source: "system-channel" as const,
    },
  };
  return {
    ...fixture,
    runtimeClosure: {
      ...closureBasis,
      contentDigest: digestAutoMovieBytes(
        Buffer.from(canonicalizeAutoMovieJson(closureBasis), "utf8"),
      ),
    },
    browser: {
      product: "chrome",
      version: "current-system-channel",
      revision: null,
      source: "system-channel",
      executableDigest: null,
    },
  };
};

/**
 * Versioned subject receipts admit only exact current passed evidence, while
 * the capture protocol round-trips one canonical owner and rejects old forms.
 */
export const test_production_subject_inspection_currentness = (): void => {
  const currentPlan = plan();
  const current = observation({ plan: currentPlan });
  const verified = verifyAutoMovieSubjectInspectionObservation({
    plan: parseAutoMovieSubjectInspectionPlan(currentPlan),
    runtimeIdentity: testCaptureRuntimeIdentity(),
    record: parseAutoMovieSubjectInspectionObservation(current.record),
    artifactBytes: current.bytes,
  });
  const system = systemChannelRuntime();
  const systemEncoded = canonicalAutoMovieCaptureRuntimeIdentity(system);

  TestValidator.equals(
    "exact passed receipt and truthful unsealed system channel retain their complete identities",
    {
      subject: verified.subject,
      planIdentity: verified.planIdentity,
      verdict: verified.verdict,
      protocol:
        parseAutoMovieCaptureRuntimeIdentity(systemEncoded).protocolVersion,
      support:
        parseAutoMovieCaptureRuntimeIdentity(systemEncoded).runtimeClosure
          .browserSupport.status,
    },
    {
      subject: "element:hero",
      planIdentity: currentPlan.planIdentity,
      verdict: "passed",
      protocol: AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL,
      support: "system-channel-unsealed",
    },
  );

  const reordered = {
    ...currentPlan,
    planned: [...currentPlan.planned].reverse(),
    poses: [...currentPlan.poses].reverse(),
  };
  TestValidator.predicate(
    "whole-plan order is semantic identity",
    autoMovieSubjectInspectionPlanIdentity(reordered) !==
      currentPlan.planIdentity,
  );

  TestValidator.equals(
    "stale, malformed, non-passed and unsupported-version twins fail closed",
    namedFacts([
      [
        "directOldProtocol",
        () =>
          throwsError(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity({
                ...system,
                protocolVersion: "automovie.capture-runtime.v1",
              } as unknown as IAutoMovieCaptureRuntimeIdentity),
            "Unsupported",
          ),
      ],
      [
        "scalarProtocol",
        () =>
          throwsError(
            () => parseAutoMovieCaptureRuntimeIdentity("null"),
            "versioned JSON object",
          ),
      ],
      [
        "compile",
        () => {
          const stale = observation({
            plan: currentPlan,
            compileFingerprint: digest("9"),
          });
          return throwsError(
            () =>
              verifyAutoMovieSubjectInspectionObservation({
                plan: currentPlan,
                runtimeIdentity: testCaptureRuntimeIdentity(),
                record: stale.record,
                artifactBytes: stale.bytes,
              }),
            "stale",
          );
        },
      ],
      [
        "runtime",
        () =>
          throwsError(
            () =>
              verifyAutoMovieSubjectInspectionObservation({
                plan: currentPlan,
                runtimeIdentity: testCaptureRuntimeIdentity("other"),
                record: current.record,
                artifactBytes: current.bytes,
              }),
            "stale",
          ),
      ],
      [
        "pose",
        () => {
          const stale = observation({ plan: currentPlan, pose: pose(99) });
          return throwsError(
            () =>
              verifyAutoMovieSubjectInspectionObservation({
                plan: currentPlan,
                runtimeIdentity: testCaptureRuntimeIdentity(),
                record: stale.record,
                artifactBytes: stale.bytes,
              }),
            "stale",
          );
        },
      ],
      [
        "bytes",
        () =>
          throwsError(
            () =>
              verifyAutoMovieSubjectInspectionObservation({
                plan: currentPlan,
                runtimeIdentity: testCaptureRuntimeIdentity(),
                record: current.record,
                artifactBytes: new TextEncoder().encode("other"),
              }),
            "stale",
          ),
      ],
      [
        "locator",
        () =>
          throwsError(
            () =>
              verifyAutoMovieSubjectInspectionObservation({
                plan: currentPlan,
                runtimeIdentity: testCaptureRuntimeIdentity(),
                record: {
                  ...current.record,
                  observation: {
                    ...current.record.observation,
                    artifact: "../foreign.png",
                  },
                },
                artifactBytes: current.bytes,
              }),
            "stale",
          ),
      ],
      [
        "v1",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionPlan({
                ...currentPlan,
                version: 1,
              }),
            "Invalid",
          ),
      ],
      [
        "planContext",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionPlan({
                ...currentPlan,
                productionId: " ",
              }),
            "non-blank context",
          ),
      ],
      [
        "planIdentity",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionPlan({
                ...currentPlan,
                planIdentity: digest("9"),
              }),
            "identity does not match",
          ),
      ],
      [
        "observationContext",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionObservation({
                ...current.record,
                observation: {
                  ...current.record.observation,
                  artifact: " ",
                },
              }),
            "exact passed context",
          ),
      ],
      [
        "observationJoins",
        () =>
          [
            { ...current.record, productionId: "other-production" },
            {
              ...current.record,
              target: { ...current.record.target, shot: "other-shot" },
            },
            { ...current.record, revision: digest("8") },
            { ...current.record, compileFingerprint: digest("8") },
            { ...current.record, planIdentity: digest("8") },
            { ...current.record, pose: pose(8) },
            {
              ...current.record,
              runtimeIdentity: testCaptureRuntimeIdentity("other"),
            },
          ].every((record) =>
            throwsError(
              () => parseAutoMovieSubjectInspectionObservation(record),
              "exact passed context",
            ),
          ),
      ],
      [
        "extra",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionObservation({
                ...current.record,
                invented: true,
              }),
            "Invalid",
          ),
      ],
      [
        "notPassed",
        () =>
          throwsError(
            () =>
              parseAutoMovieSubjectInspectionObservation({
                ...current.record,
                verdict: "not-run",
              }),
            "Invalid",
          ),
      ],
      [
        "oldProtocol",
        () =>
          throwsError(
            () =>
              parseAutoMovieCaptureRuntimeIdentity(
                systemEncoded.replace(
                  AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL,
                  "automovie.capture-runtime.v1",
                ),
              ),
            "Unsupported",
          ),
      ],
      [
        "malformedProtocol",
        () =>
          throwsError(
            () => parseAutoMovieCaptureRuntimeIdentity("{"),
            "not JSON",
          ),
      ],
    ]),
    {
      compile: true,
      directOldProtocol: true,
      scalarProtocol: true,
      runtime: true,
      pose: true,
      bytes: true,
      locator: true,
      v1: true,
      planContext: true,
      planIdentity: true,
      observationContext: true,
      observationJoins: true,
      extra: true,
      notPassed: true,
      oldProtocol: true,
      malformedProtocol: true,
    },
  );
};
