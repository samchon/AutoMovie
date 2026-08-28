import {
  IAutoMovieAssetManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  IAutoMovieRepaintAttemptRecord,
  canonicalAutoMovieRepaintRuntimeIdentity,
  digestAutoMovieBytes,
  probeProductionVideoMp4,
  productionRenderBundleRelativePath,
  productionRepaintActiveReceiptPath,
  productionRepaintOutputPath,
  productionRepaintReceiptPath,
  productionRepaintRequestFingerprint,
  productionRepaintStructuralControls,
  productionSourceRenderFingerprint,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  productionCompileSucceeded,
  productionFixture,
  testRendererIdentity,
} from "./productionFixtures";
import { productionH264Mp4, productionPng } from "./productionMediaFixtures";

interface IRepaintRecordCleanupFailure {
  error: unknown;
}

class RepaintRecordCleanupError extends AggregateError {}

const preserveRepaintRecordCleanup = (
  failure: IRepaintRecordCleanupFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RepaintRecordCleanupError(
      [failure.error, cleanupFailure],
      "Repaint-record fixture cleanup failed after the assertion failed.",
    );
  }
};

const writeTrackedJson = (
  project: AutoMovieProductionProject,
  relative: string,
  value: unknown,
): void => {
  const file = project.trackedStatePath(relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const repaintReceipt = (shot: string): IAutoMovieRepaintReceipt => {
  const outputPath = "repaint/missing-output.mp4";
  return {
    version: 4,
    productionId: "fixture-film",
    shot,
    compileFingerprint: `sha256:${"1".repeat(64)}`,
    sourceRenderFingerprint: `sha256:${"2".repeat(64)}`,
    requestId: "00000000-0000-4000-8000-000000000010",
    attemptId: "00000000-0000-4000-8000-000000000001",
    startedAt: "2026-08-28T12:00:00.000Z",
    completedAt: "2026-08-28T12:00:01.000Z",
    costUnits: 0,
    executionPolicy: {
      maximumAttempts: 1,
      attemptTimeoutMs: 1_000,
      maximumElapsedMs: 1_000,
      maximumCostUnits: 0,
      backoffMs: [],
      retryableFailures: [],
    },
    sourceBundle: "shot-opening/source/render",
    controls: [
      {
        pass: "depth",
        frameDigests: [`sha256:${"3".repeat(64)}`],
      },
    ],
    references: [
      {
        role: "style",
        path: "public/assets/repaint-reference.png",
        digest: `sha256:${"4".repeat(64)}`,
      },
    ],
    adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity({
      protocolVersion: "automovie.repaint-runtime.v1",
      provider: "runtime-shape-test",
      model: "runtime-shape-test",
      version: "1",
      execution: "local",
    }),
    generatorProvenance: {
      source: "local://runtime-shape-test",
      license: "test-only",
      termsCheckedAt: "2026-08-28",
      cost: "local test fixture",
      consumer: {
        kind: "repaint",
        reason: "Exercise stored repaint receipt integrity.",
      },
    },
    structuralAuthority: "deterministic-source-only",
    parameters: {
      prompt: "Keep the deterministic structure.",
      negativePrompt: "Do not alter camera or motion.",
      seed: 7,
      strength: 0.5,
      controls: { guidance: 1 },
    },
    evidence: {
      prompt: "scripts/repaint.ts#opening-prompt",
      continuity: null,
      settings: "docs/settings/production.md#visual-grammar",
      design: "docs/designs/opening.md#appearance",
      screenplayOrBrief: "docs/screenplays/opening.md#opening",
      shot: "scripts/shots/opening.ts#opening",
    },
    output: {
      path: outputPath,
      digest: digestAutoMovieBytes(Buffer.from("missing output")),
      bytes: 14,
      probe: {
        kind: "video",
        container: "mp4",
        codec: "h264",
        width: 16,
        height: 16,
        runtimeSeconds: 6,
        frameCount: 144,
        fps: 24,
      },
    },
  };
};

const repaintAttempt = (
  override: Partial<IAutoMovieRepaintAttemptRecord> = {},
): IAutoMovieRepaintAttemptRecord => ({
  version: 1,
  productionId: "fixture-film",
  shot: "opening",
  requestId: "00000000-0000-4000-8000-000000000030",
  attemptId: "00000000-0000-4000-8000-000000000031",
  ordinal: 2,
  requestFingerprint: `sha256:${"1".repeat(64)}`,
  compileFingerprint: `sha256:${"2".repeat(64)}`,
  sourceRenderFingerprint: `sha256:${"3".repeat(64)}`,
  adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity({
    protocolVersion: "automovie.repaint-runtime.v1",
    provider: "runtime-shape-test",
    model: "runtime-shape-model",
    version: "sha256:runtime-shape-model",
    execution: "local",
  }),
  seed: 7,
  startedAt: "2026-08-28T12:00:00.000Z",
  completedAt: "2026-08-28T12:00:01.000Z",
  status: "succeeded",
  failure: null,
  costUnits: 1,
  availableOutput: {
    digest: `sha256:${"4".repeat(64)}`,
    bytes: 4,
  },
  ...override,
});

const succeededAttemptForReceipt = (
  receipt: IAutoMovieRepaintReceipt,
): IAutoMovieRepaintAttemptRecord => ({
  version: 1,
  productionId: receipt.productionId,
  shot: receipt.shot,
  requestId: receipt.requestId!,
  attemptId: receipt.attemptId,
  ordinal: 1,
  requestFingerprint: productionRepaintRequestFingerprint({
    shot: receipt.shot,
    compileFingerprint: receipt.compileFingerprint,
    sourceRenderFingerprint: receipt.sourceRenderFingerprint,
    adapterIdentity: receipt.adapterIdentity,
    generatorProvenance: receipt.generatorProvenance,
    parameters: receipt.parameters,
    executionPolicy: receipt.executionPolicy!,
    evidence: receipt.evidence!,
    references: receipt.references,
  }),
  compileFingerprint: receipt.compileFingerprint,
  sourceRenderFingerprint: receipt.sourceRenderFingerprint,
  adapterIdentity: receipt.adapterIdentity,
  seed: receipt.parameters.seed,
  startedAt: receipt.startedAt!,
  completedAt: receipt.completedAt!,
  status: "succeeded",
  failure: null,
  costUnits: receipt.costUnits!,
  availableOutput: {
    digest: receipt.output.digest,
    bytes: receipt.output.bytes,
  },
});

/**
 * Enumerate stored repaint records through every early integrity boundary.
 * Each corrupt attempt ledger is refused rather than silently reopening a
 * consumed retry budget, while active pointer/receipt bytes are asserted so a
 * missing write cannot make the same empty result pass.
 *
 * Scenarios:
 *
 * 1. Terminal repaint attempts validate every identity, time, cost, state, and
 *    available-output boundary; immutable records enumerate in ordinal/id order.
 * 2. Malformed and schema-invalid active pointers and selections are omitted.
 * 3. Missing, malformed, schema-invalid, wrong-shot, and noncanonical immutable
 *    receipts are omitted while their resident bytes are asserted.
 * 4. A canonical pointer/selection/receipt with absent output bytes is omitted.
 * 5. The positive twin compiles current inputs, commits a verified source
 *    bundle, real H.264 output, fixed reference, and immutable repaint receipt,
 *    then enumerates that exact receipt once from duplicate shot requests.
 * 6. Missing/stale compile and source evidence plus invalid adapter identities
 *    refuse before any receipt update.
 * 7. Asset-manifest, resident-byte, shot-use, role-duplicate, and all-role
 *    collapse probes preserve distinct fixed-reference authority.
 * 8. Output production/path/digest/size and parsed raster/clock/count facts are
 *    each checked against real H.264 bytes.
 * 9. Removing the production or shot record proves stored media targets are
 *    revalidated rather than trusted from an old receipt.
 */
export const test_production_project_runtime_shape_repaint_records =
  async (): Promise<void> => {
    const fixture = productionFixture();
    let failure: IRepaintRecordCleanupFailure | undefined;
    try {
      const project = AutoMovieProductionProject.open(
        fixture.root,
        "fixture-film",
      );
      const shot = "opening";

      TestValidator.equals(
        "an absent repaint candidate directory has no candidates",
        project.verifiedRepaintCandidates(),
        [],
      );
      const repaintDirectory = project.trackedStatePath("renditions");
      const externalCandidates = path.join(fixture.root, "external-candidates");
      fs.mkdirSync(externalCandidates);
      fs.symlinkSync(
        externalCandidates,
        repaintDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      try {
        project.verifiedRepaintCandidates();
        throw new Error(
          "Linked repaint candidate directory unexpectedly read.",
        );
      } catch (error) {
        TestValidator.predicate(
          "candidate enumeration refuses a linked directory",
          error instanceof Error &&
            error.message.includes("must not be a link"),
        );
      }
      fs.rmSync(repaintDirectory);

      const requestId = "00000000-0000-4000-8000-000000000030";
      TestValidator.equals(
        "an absent request has no terminal repaint attempts",
        project.repaintRequestAttempts(requestId),
        [],
      );
      try {
        project.repaintRequestAttempts("not-a-request-id");
        throw new Error("Malformed request id unexpectedly enumerated.");
      } catch (error) {
        TestValidator.predicate(
          "attempt enumeration requires a UUID v4 request id",
          error instanceof Error && error.message.includes("must be a UUID v4"),
        );
      }
      const expectAttemptRefusal = (
        label: string,
        candidate: IAutoMovieRepaintAttemptRecord,
      ): void => {
        try {
          project.commitRepaintAttempt(candidate);
          throw new Error(`${label} unexpectedly committed.`);
        } catch (error) {
          TestValidator.predicate(
            label,
            error instanceof Error &&
              (error.message.includes("attempt record is malformed") ||
                error.message.includes("must be a UUID v4")),
          );
        }
      };
      const invalidAttempts: Array<
        readonly [string, IAutoMovieRepaintAttemptRecord]
      > = [
        [
          "attempt format version is exact",
          repaintAttempt({ version: 2 as 1 }),
        ],
        [
          "attempt production is current",
          repaintAttempt({ productionId: "other-production" }),
        ],
        ["attempt shot is nonblank", repaintAttempt({ shot: " " })],
        ["attempt shot is trimmed", repaintAttempt({ shot: " padded " })],
        [
          "attempt schema is exact",
          {
            ...repaintAttempt(),
            hidden: true,
          } as IAutoMovieRepaintAttemptRecord,
        ],
        [
          "attempt request id is a UUID v4",
          repaintAttempt({ requestId: "bad" }),
        ],
        ["attempt id is a UUID v4", repaintAttempt({ attemptId: "bad" })],
        ["attempt ordinal is an integer", repaintAttempt({ ordinal: 1.5 })],
        ["attempt ordinal is positive", repaintAttempt({ ordinal: 0 })],
        [
          "attempt request fingerprint is a digest",
          repaintAttempt({ requestFingerprint: "sha256:" }),
        ],
        [
          "attempt compile fingerprint is a digest",
          repaintAttempt({ compileFingerprint: "sha256:" }),
        ],
        [
          "attempt source fingerprint is a digest",
          repaintAttempt({ sourceRenderFingerprint: "sha256:" }),
        ],
        ...([63, 65] as const).flatMap((length) => [
          [
            `attempt request fingerprint has exactly 64 hexadecimal characters (${length})`,
            repaintAttempt({
              requestFingerprint: `sha256:${"1".repeat(length)}`,
            }),
          ] as const,
          [
            `attempt compile fingerprint has exactly 64 hexadecimal characters (${length})`,
            repaintAttempt({
              compileFingerprint: `sha256:${"2".repeat(length)}`,
            }),
          ] as const,
          [
            `attempt source fingerprint has exactly 64 hexadecimal characters (${length})`,
            repaintAttempt({
              sourceRenderFingerprint: `sha256:${"3".repeat(length)}`,
            }),
          ] as const,
          [
            `available attempt output digest has exactly 64 hexadecimal characters (${length})`,
            repaintAttempt({
              availableOutput: {
                digest: `sha256:${"4".repeat(length)}`,
                bytes: 1,
              },
            }),
          ] as const,
        ]),
        [
          "attempt adapter identity is nonblank",
          repaintAttempt({ adapterIdentity: " " }),
        ],
        [
          "attempt adapter identity is trimmed",
          repaintAttempt({ adapterIdentity: " padded " }),
        ],
        [
          "attempt adapter identity is canonical json",
          repaintAttempt({
            adapterIdentity: JSON.stringify(
              {
                protocolVersion: "automovie.repaint-runtime.v1",
                provider: "runtime-shape-test",
                model: "runtime-shape-model",
                version: "sha256:runtime-shape-model",
                execution: "local",
              },
              null,
              2,
            ),
          }),
        ],
        [
          "attempt adapter identity is valid json",
          repaintAttempt({ adapterIdentity: "{" }),
        ],
        ["attempt seed is an integer", repaintAttempt({ seed: 1.5 })],
        ["attempt start is an instant", repaintAttempt({ startedAt: "bad" })],
        [
          "attempt completion is an instant",
          repaintAttempt({ completedAt: "bad" }),
        ],
        [
          "attempt start is canonical UTC",
          repaintAttempt({ startedAt: "2026-08-28T12:00:00Z" }),
        ],
        [
          "attempt completion is canonical UTC",
          repaintAttempt({ completedAt: "2026-08-28T12:00:01Z" }),
        ],
        [
          "attempt completion does not precede start",
          repaintAttempt({ completedAt: "2026-08-28T11:59:59.000Z" }),
        ],
        ["attempt cost is finite", repaintAttempt({ costUnits: Number.NaN })],
        ["attempt cost is nonnegative", repaintAttempt({ costUnits: -1 })],
        [
          "attempt status belongs to the public vocabulary",
          repaintAttempt({ status: "pending" as "failed" }),
        ],
        [
          "successful attempt has no failure",
          repaintAttempt({
            failure: {
              class: "internal",
              message: "unexpected",
              retryable: false,
            },
          }),
        ],
        ["failed attempt has a failure", repaintAttempt({ status: "failed" })],
        [
          "attempt failure class belongs to the public vocabulary",
          repaintAttempt({
            status: "failed",
            failure: {
              class: "unknown" as "timeout",
              message: "unknown class",
              retryable: false,
            },
            availableOutput: null,
          }),
        ],
        [
          "attempt retryable flag is boolean",
          repaintAttempt({
            status: "failed",
            failure: {
              class: "timeout",
              message: "invalid retryable flag",
              retryable: "true" as unknown as boolean,
            },
            availableOutput: null,
          }),
        ],
        [
          "attempt failure message is nonblank",
          repaintAttempt({
            status: "failed",
            failure: { class: "timeout", message: " ", retryable: true },
            availableOutput: null,
          }),
        ],
        [
          "only a failed attempt may be retryable",
          repaintAttempt({
            status: "cancelled",
            failure: {
              class: "cancelled",
              message: "cancelled",
              retryable: true,
            },
            availableOutput: null,
          }),
        ],
        [
          "invalid output cannot be marked retryable",
          repaintAttempt({
            status: "invalid",
            failure: {
              class: "invalid-output",
              message: "invalid output",
              retryable: true,
            },
            availableOutput: null,
          }),
        ],
        [
          "input-stale attempts cannot be marked retryable",
          repaintAttempt({
            status: "stale",
            failure: {
              class: "input-stale",
              message: "input became stale",
              retryable: true,
            },
            availableOutput: null,
          }),
        ],
        [
          "budget exhaustion cannot be marked retryable",
          repaintAttempt({
            status: "failed",
            failure: {
              class: "budget-exhausted",
              message: "budget exhausted",
              retryable: true,
            },
            availableOutput: null,
          }),
        ],
        [
          "attempt failure class agrees with terminal status",
          repaintAttempt({
            status: "cancelled",
            failure: {
              class: "provider-refusal",
              message: "provider refusal cannot be cancelled",
              retryable: false,
            },
            availableOutput: null,
          }),
        ],
        [
          "successful attempt retains available output identity",
          repaintAttempt({ availableOutput: null }),
        ],
        [
          "available attempt output has positive bytes",
          repaintAttempt({
            availableOutput: { digest: `sha256:${"4".repeat(64)}`, bytes: 0 },
          }),
        ],
        [
          "available attempt output has finite bytes",
          repaintAttempt({
            availableOutput: {
              digest: `sha256:${"4".repeat(64)}`,
              bytes: Number.POSITIVE_INFINITY,
            },
          }),
        ],
        [
          "available attempt output has integer bytes",
          repaintAttempt({
            availableOutput: {
              digest: `sha256:${"4".repeat(64)}`,
              bytes: 1.5,
            },
          }),
        ],
        [
          "available attempt output has a digest",
          repaintAttempt({ availableOutput: { digest: "sha256:", bytes: 1 } }),
        ],
      ];
      invalidAttempts.forEach(([label, candidate]) =>
        expectAttemptRefusal(label, candidate),
      );

      const retryAttempt = repaintAttempt({
        startedAt: "2026-08-28T12:00:01.000Z",
        completedAt: "2026-08-28T12:00:02.000Z",
        status: "failed",
        failure: {
          class: "rate-limit",
          message: "provider requested another attempt",
          retryable: true,
        },
        availableOutput: null,
      });
      const failedAttempt = repaintAttempt({
        attemptId: "00000000-0000-4000-8000-000000000032",
        ordinal: 1,
        status: "failed",
        failure: { class: "timeout", message: "timed out", retryable: true },
        costUnits: 0,
        availableOutput: null,
      });
      const succeededAttempt = repaintAttempt({
        attemptId: "00000000-0000-4000-8000-000000000033",
        ordinal: 3,
        startedAt: "2026-08-28T12:00:02.000Z",
        completedAt: "2026-08-28T12:00:03.000Z",
      });
      project.commitRepaintAttempt(failedAttempt);
      const expectCommitRefusal = (
        label: string,
        candidate: IAutoMovieRepaintAttemptRecord,
        inputCurrent?: () => boolean,
      ): void => {
        try {
          project.commitRepaintAttempt(candidate, inputCurrent);
          throw new Error(`${label} unexpectedly committed.`);
        } catch (error) {
          TestValidator.predicate(label, error instanceof Error);
        }
      };
      const succeededRequest = "00000000-0000-4000-8000-000000000050";
      project.commitRepaintAttempt(
        repaintAttempt({
          requestId: succeededRequest,
          attemptId: "00000000-0000-4000-8000-000000000051",
          ordinal: 1,
        }),
      );
      expectCommitRefusal(
        "attempt commit refuses an append after a succeeded terminal",
        repaintAttempt({
          requestId: succeededRequest,
          attemptId: "00000000-0000-4000-8000-000000000052",
          ordinal: 2,
          startedAt: "2026-08-28T12:00:01.000Z",
          completedAt: "2026-08-28T12:00:02.000Z",
        }),
      );
      const nonretryableRequest = "00000000-0000-4000-8000-000000000060";
      project.commitRepaintAttempt(
        repaintAttempt({
          requestId: nonretryableRequest,
          attemptId: "00000000-0000-4000-8000-000000000061",
          ordinal: 1,
          status: "failed",
          failure: {
            class: "provider-refusal",
            message: "provider refused without retry permission",
            retryable: false,
          },
          availableOutput: null,
        }),
      );
      expectCommitRefusal(
        "attempt commit refuses an append after a nonretryable failure",
        repaintAttempt({
          requestId: nonretryableRequest,
          attemptId: "00000000-0000-4000-8000-000000000062",
          ordinal: 2,
          startedAt: "2026-08-28T12:00:01.000Z",
          completedAt: "2026-08-28T12:00:02.000Z",
        }),
      );
      expectCommitRefusal(
        "attempt commit refuses a skipped ordinal",
        succeededAttempt,
      );
      expectCommitRefusal(
        "attempt commit refuses a tied ordinal",
        repaintAttempt({
          attemptId: "00000000-0000-4000-8000-000000000042",
          ordinal: 1,
        }),
      );
      expectCommitRefusal(
        "attempt commit refuses immutable request-identity drift",
        {
          ...retryAttempt,
          attemptId: "00000000-0000-4000-8000-000000000043",
          requestFingerprint: `sha256:${"9".repeat(64)}`,
        },
      );
      expectCommitRefusal(
        "attempt commit preserves its input-current fence",
        retryAttempt,
        () => false,
      );
      let postWriteChecks = 0;
      expectCommitRefusal(
        "attempt commit rolls back when its post-write input fence changes",
        retryAttempt,
        () => ++postWriteChecks === 1,
      );
      TestValidator.equals(
        "post-write attempt refusal removes the tentative resident",
        {
          checks: postWriteChecks,
          resident: fs.existsSync(
            project.trackedStatePath(
              `renditions/attempts/${requestId}/${retryAttempt.attemptId}.json`,
            ),
          ),
          ledger: project.repaintRequestAttempts(requestId),
        },
        { checks: 2, resident: false, ledger: [failedAttempt] },
      );
      project.commitRepaintAttempt(retryAttempt);
      project.commitRepaintAttempt(succeededAttempt);
      try {
        project.commitRepaintAttempt(succeededAttempt);
        throw new Error(
          "Duplicate terminal repaint attempt unexpectedly committed.",
        );
      } catch (error) {
        TestValidator.predicate(
          "terminal repaint attempts are immutable",
          error instanceof Error && error.message.includes("already exists"),
        );
      }
      const attemptDirectory = project.trackedStatePath(
        `renditions/attempts/${requestId}`,
      );
      fs.writeFileSync(path.join(attemptDirectory, "ignored.txt"), "ignored");
      const expectLedgerRefusal = (
        label: string,
        resident: string,
        prepare: () => void,
      ): void => {
        prepare();
        try {
          project.repaintRequestAttempts(requestId);
          throw new Error(`${label} unexpectedly enumerated.`);
        } catch (error) {
          TestValidator.predicate(label, error instanceof Error);
        } finally {
          fs.rmSync(resident, { force: true, recursive: true });
        }
      };
      const directoryResident = path.join(attemptDirectory, "ignored.json");
      expectLedgerRefusal(
        "attempt ledger refuses a json directory resident",
        directoryResident,
        () => fs.mkdirSync(directoryResident),
      );
      const brokenResident = path.join(
        attemptDirectory,
        "00000000-0000-4000-8000-000000000040.json",
      );
      expectLedgerRefusal(
        "attempt ledger refuses malformed json",
        brokenResident,
        () => fs.writeFileSync(brokenResident, "{broken"),
      );
      const foreignResident = path.join(
        attemptDirectory,
        "00000000-0000-4000-8000-000000000035.json",
      );
      expectLedgerRefusal(
        "attempt ledger refuses a foreign request identity",
        foreignResident,
        () =>
          fs.writeFileSync(
            foreignResident,
            `${JSON.stringify(
              repaintAttempt({
                requestId: "00000000-0000-4000-8000-000000000034",
                attemptId: "00000000-0000-4000-8000-000000000035",
                ordinal: 4,
              }),
              null,
              2,
            )}\n`,
          ),
      );
      const noncanonicalResident = path.join(
        attemptDirectory,
        "wrong-request.json",
      );
      expectLedgerRefusal(
        "attempt ledger refuses a noncanonical attempt path",
        noncanonicalResident,
        () =>
          fs.writeFileSync(
            noncanonicalResident,
            `${JSON.stringify(
              repaintAttempt({
                attemptId: "00000000-0000-4000-8000-000000000041",
                ordinal: 4,
              }),
              null,
              2,
            )}\n`,
          ),
      );
      const thirdPath = path.join(
        attemptDirectory,
        `${succeededAttempt.attemptId}.json`,
      );
      fs.writeFileSync(
        thirdPath,
        `${JSON.stringify({ ...succeededAttempt, ordinal: 2 }, null, 2)}\n`,
      );
      try {
        project.repaintRequestAttempts(requestId);
        throw new Error("Duplicate repaint ordinals unexpectedly enumerated.");
      } catch (error) {
        TestValidator.predicate(
          "attempt ledger refuses duplicate ordinals",
          error instanceof Error,
        );
      } finally {
        fs.writeFileSync(
          thirdPath,
          `${JSON.stringify(succeededAttempt, null, 2)}\n`,
        );
      }
      fs.writeFileSync(
        thirdPath,
        `${JSON.stringify(
          { ...succeededAttempt, startedAt: "2026-08-28T12:00:01.999Z" },
          null,
          2,
        )}\n`,
      );
      try {
        project.repaintRequestAttempts(requestId);
        throw new Error(
          "Overlapping repaint attempts unexpectedly enumerated.",
        );
      } catch (error) {
        TestValidator.predicate(
          "attempt ledger refuses chronology that overlaps its predecessor",
          error instanceof Error,
        );
      } finally {
        fs.writeFileSync(
          thirdPath,
          `${JSON.stringify(succeededAttempt, null, 2)}\n`,
        );
      }
      TestValidator.equals(
        "terminal attempts enumerate one contiguous immutable request ledger",
        project.repaintRequestAttempts(requestId),
        [failedAttempt, retryAttempt, succeededAttempt],
      );
      const linkedRequest = "00000000-0000-4000-8000-000000000036";
      const linkedDirectory = project.trackedStatePath(
        `renditions/attempts/${linkedRequest}`,
      );
      const externalAttempts = path.join(fixture.root, "external-attempts");
      fs.mkdirSync(externalAttempts);
      fs.symlinkSync(
        externalAttempts,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      try {
        project.repaintRequestAttempts(linkedRequest);
        throw new Error("Linked attempt directory unexpectedly enumerated.");
      } catch (error) {
        TestValidator.predicate(
          "attempt enumeration refuses a linked directory",
          error instanceof Error &&
            error.message.includes("must not be a link"),
        );
      }

      const activePath = productionRepaintActiveReceiptPath(shot);
      const activeFile = project.trackedStatePath(activePath);
      fs.mkdirSync(path.dirname(activeFile), { recursive: true });

      fs.writeFileSync(activeFile, "{broken");
      TestValidator.equals(
        "malformed active pointer is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, activePath, { version: 99 });
      TestValidator.equals(
        "wrong active-pointer schema is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      const receipt = repaintReceipt(shot);
      const trackedReceipt = productionRepaintReceiptPath(receipt.output.path);
      const selectionId = "00000000-0000-4000-8000-000000000011";
      const selectionPath = `renditions/selections/${shot}/${selectionId}.json`;
      const pointer = {
        version: 2 as const,
        shot,
        selection: selectionPath,
        receipt: trackedReceipt,
        output: receipt.output.path,
      };
      writeTrackedJson(project, activePath, pointer);
      TestValidator.equals(
        "active pointer without its immutable selection is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, selectionPath, { version: 99 });
      TestValidator.equals(
        "wrong selection schema is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );
      writeTrackedJson(project, selectionPath, {
        version: 1,
        selectionId,
        kind: "selection",
        productionId: "fixture-film",
        shot,
        requestId: receipt.requestId,
        attemptId: receipt.attemptId,
        selectedAt: "2026-08-28T12:00:02.000Z",
        candidateReceipt: trackedReceipt,
        output: receipt.output.path,
        previousSelection: null,
        reason: "Exercise stored repaint selection integrity.",
        structuralReview: "The deterministic structure remains unchanged.",
        continuityReview: null,
      });
      TestValidator.equals(
        "active selection without its immutable receipt is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      const receiptFile = project.trackedStatePath(trackedReceipt);
      fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
      fs.writeFileSync(receiptFile, "{broken");
      TestValidator.equals(
        "malformed immutable receipt is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, { version: 3 });
      TestValidator.equals(
        "wrong receipt schema is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, repaintReceipt("other-shot"));
      TestValidator.equals(
        "receipt addressed to another shot is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, receipt);
      writeTrackedJson(project, activePath, {
        ...pointer,
        output: "wrong.mp4",
      });
      TestValidator.equals(
        "noncanonical active pointer is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, activePath, pointer);
      TestValidator.equals(
        "canonical record with missing output bytes is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );
      TestValidator.predicate(
        "the final omission was tested against resident pointer and receipt bytes",
        fs.existsSync(activeFile) && fs.existsSync(receiptFile),
      );
      fs.rmSync(activeFile);
      fs.rmSync(receiptFile);

      const referencePath = "public/assets/runtime-shape-reference.png";
      const referenceBytes = productionPng(16, 16);
      const referenceFile = path.join(fixture.root, referencePath);
      fs.mkdirSync(path.dirname(referenceFile), { recursive: true });
      fs.writeFileSync(referenceFile, referenceBytes);
      const assetFile = path.join(fixture.root, "automovie/assets.json");
      const assets = JSON.parse(
        fs.readFileSync(assetFile, "utf8"),
      ) as IAutoMovieAssetManifest;
      const referenceDigest = digestAutoMovieBytes(referenceBytes);
      assets.assets.push({
        path: referencePath,
        digest: referenceDigest,
        original: {
          url: "https://example.invalid/runtime-shape-reference.png",
          digest: referenceDigest,
        },
        license: {
          identifier: "test-only",
          url: "https://example.invalid/test-only-license",
          notice: "Generated entirely inside the runtime-shape test.",
        },
        processing: [],
        uses: [
          {
            production: "fixture-film",
            consumer: { kind: "rendition-reference", id: shot },
            reason: "Positive stored repaint selection fixture.",
          },
        ],
      });
      assets.assets.sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      );
      fs.writeFileSync(assetFile, `${JSON.stringify(assets, null, 2)}\n`);

      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded("stored repaint record", compiled) === false
      )
        throw new Error("Stored repaint record fixture did not compile.");
      const generated = project.generatedManifest();
      if (generated === null)
        throw new Error(
          "Stored repaint record fixture has no generated manifest.",
        );

      const frameBytes = productionPng(16, 16);
      const sourceManifest: IAutoMovieRenderBundleManifest = {
        version: 5,
        target: { kind: "shot", id: shot },
        compileFingerprint: generated.inputFingerprint,
        dialogueRuntimeIdentity: null,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint: digestAutoMovieBytes(
          Buffer.from("runtime-shape-opening-target"),
        ),
        renderSpec: {
          target: shot,
          frameFormat: { width: 16, height: 16, fps: 24 },
          toneMapping: "none",
          codec: "h264",
          pixelFormat: "yuv420p",
          crf: 17,
        },
        frames: [
          {
            index: 0,
            time: 0,
            pass: "depth",
            path: "depth-000000.png",
            digest: digestAutoMovieBytes(frameBytes),
            width: 16,
            height: 16,
          },
        ],
      };
      const sourceBundle = productionRenderBundleRelativePath(sourceManifest);
      project.commitRenderBundle(
        sourceBundle,
        new Map([["depth-000000.png", frameBytes]]),
        sourceManifest,
      );

      const outputBytes = await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 24,
        frameCount: 144,
      });
      const outputDigest = digestAutoMovieBytes(outputBytes);
      const adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity({
        protocolVersion: "automovie.repaint-runtime.v1",
        provider: "runtime-shape-test",
        model: "runtime-shape-test",
        version: "1",
        execution: "local",
      });
      const generatorProvenance = {
        source: "local://runtime-shape-test",
        license: "test-only",
        termsCheckedAt: "2026-08-28",
        cost: "local test fixture",
        consumer: {
          kind: "repaint" as const,
          reason: "Exercise a complete stored repaint receipt.",
        },
      };
      const parameters = {
        prompt: "Keep the deterministic structure.",
        negativePrompt: "Do not alter camera or motion.",
        seed: 7,
        strength: 0.5,
        controls: { guidance: 1 },
      };
      const executionPolicy = {
        maximumAttempts: 1,
        attemptTimeoutMs: 1_000,
        maximumElapsedMs: 1_000,
        maximumCostUnits: 1,
        backoffMs: [],
        retryableFailures: [] as [],
      };
      const evidence = {
        prompt: "scripts/repaint.ts#opening-prompt",
        continuity: "docs/settings/continuity.md#opening",
        settings: "docs/settings/production.md#visual-grammar",
        design: "docs/designs/opening.md#appearance",
        screenplayOrBrief: "docs/screenplays/opening.md#opening",
        shot: "scripts/shots/opening.ts#opening",
      };
      const continuityReview = {
        baseline: evidence.continuity,
        playbackEvidence: "The candidate passed sequence playback review.",
        mixedDeliveryPolicy: "The cut preserves the deterministic transition.",
        flicker: "pass" as const,
        identityDrift: "pass" as const,
        geometryWarp: "pass" as const,
        textureCrawl: "pass" as const,
        transitionMismatch: "pass" as const,
      };
      const references = [
        {
          role: "style" as const,
          path: referencePath,
          digest: referenceDigest,
        },
      ];
      const sourceRenderFingerprint = productionSourceRenderFingerprint({
        manifest: sourceManifest,
        frames: sourceManifest.frames,
      });
      const outputPath = productionRepaintOutputPath({
        shot,
        sourceRenderFingerprint,
        attemptId: "00000000-0000-4000-8000-000000000002",
        adapterIdentity,
        generatorProvenance,
        parameters,
        executionPolicy,
        evidence,
        references,
        outputDigest,
      });
      const validReceipt: IAutoMovieRepaintReceipt = {
        version: 4,
        productionId: "fixture-film",
        shot,
        compileFingerprint: generated.inputFingerprint,
        sourceRenderFingerprint,
        requestId: "00000000-0000-4000-8000-000000000020",
        attemptId: "00000000-0000-4000-8000-000000000002",
        startedAt: "2026-08-28T12:00:00.000Z",
        completedAt: "2026-08-28T12:00:01.000Z",
        costUnits: 1,
        executionPolicy,
        sourceBundle,
        controls: productionRepaintStructuralControls(sourceManifest),
        references,
        adapterIdentity,
        generatorProvenance,
        structuralAuthority: "deterministic-source-only",
        parameters,
        evidence,
        output: {
          path: outputPath,
          digest: outputDigest,
          bytes: outputBytes.length,
          probe: probeProductionVideoMp4(outputBytes),
        },
      };
      try {
        project.commitRepaintRendition(validReceipt, outputBytes);
        throw new Error(
          "Repaint receipt without a terminal attempt unexpectedly committed.",
        );
      } catch (error) {
        TestValidator.predicate(
          "repaint receipt requires a resident succeeded terminal attempt",
          error instanceof Error &&
            error.message.includes("immutable succeeded terminal attempt"),
        );
      }
      const validAttempt = succeededAttemptForReceipt(validReceipt);
      project.commitRepaintAttempt(validAttempt);
      project.commitRepaintRendition(validReceipt, outputBytes);
      const validAttemptPath = `renditions/attempts/${validAttempt.requestId}/${validAttempt.attemptId}.json`;
      const expectAttemptBoundCandidateOmitted = (
        label: string,
        mutate: (attempt: IAutoMovieRepaintAttemptRecord) => void,
      ): void => {
        const candidate = structuredClone(validAttempt);
        mutate(candidate);
        writeTrackedJson(project, validAttemptPath, candidate);
        TestValidator.equals(label, project.verifiedRepaintCandidates(), []);
        writeTrackedJson(project, validAttemptPath, validAttempt);
      };
      for (const [label, mutate] of [
        [
          "candidate refuses a failed terminal attempt",
          (attempt: IAutoMovieRepaintAttemptRecord): void => {
            attempt.status = "failed";
            attempt.failure = {
              class: "provider-refusal",
              message: "provider refused",
              retryable: false,
            };
          },
        ],
        [
          "candidate refuses a mismatched request fingerprint",
          (attempt: IAutoMovieRepaintAttemptRecord): void => {
            attempt.requestFingerprint = `sha256:${"a".repeat(64)}`;
          },
        ],
        [
          "candidate refuses mismatched attempt timing",
          (attempt: IAutoMovieRepaintAttemptRecord): void => {
            attempt.startedAt = "2026-08-28T11:59:59.000Z";
          },
        ],
        [
          "candidate refuses mismatched attempt cost",
          (attempt: IAutoMovieRepaintAttemptRecord): void => {
            attempt.costUnits += 1;
          },
        ],
        [
          "candidate refuses mismatched available output",
          (attempt: IAutoMovieRepaintAttemptRecord): void => {
            attempt.availableOutput = {
              digest: `sha256:${"b".repeat(64)}`,
              bytes: validReceipt.output.bytes,
            };
          },
        ],
      ] as const)
        expectAttemptBoundCandidateOmitted(label, mutate);
      fs.writeFileSync(path.join(repaintDirectory, "ignored.txt"), "ignored");
      fs.writeFileSync(path.join(repaintDirectory, "broken.json"), "{broken");
      writeTrackedJson(project, "renditions/foreign.json", {
        ...validReceipt,
        shot: "other-shot",
      });
      writeTrackedJson(project, "renditions/duplicate.json", validReceipt);
      TestValidator.equals(
        "candidate enumeration omits malformed, foreign, and noncanonical duplicate residents",
        project.verifiedRepaintCandidates(),
        [validReceipt],
      );
      TestValidator.equals(
        "candidate enumeration filters before reading another shot output",
        project.verifiedRepaintCandidates([shot]),
        [validReceipt],
      );
      fs.rmSync(path.join(repaintDirectory, "broken.json"));
      fs.rmSync(path.join(repaintDirectory, "foreign.json"));
      fs.rmSync(path.join(repaintDirectory, "duplicate.json"));
      const selectionProps = {
        shot,
        attemptId: validReceipt.attemptId,
        kind: "selection" as const,
        reason: "Select the structurally reviewed candidate.",
        structuralReview: "The deterministic structure remains unchanged.",
        continuityReview,
        selectedAt: "2026-08-28T12:00:02.000Z",
      };
      const expectSelectionRefusal = (
        label: string,
        props: Parameters<typeof project.selectRepaintCandidate>[0],
        message: string,
      ): void => {
        try {
          project.selectRepaintCandidate(props);
          throw new Error(`${label} unexpectedly selected.`);
        } catch (error) {
          TestValidator.predicate(
            label,
            error instanceof Error && error.message.includes(message),
          );
        }
      };
      expectSelectionRefusal(
        "selection refuses an absent candidate",
        {
          ...selectionProps,
          attemptId: "00000000-0000-4000-8000-000000000099",
        },
        "absent, invalid, or stale",
      );
      expectSelectionRefusal(
        "selection requires a valid instant",
        { ...selectionProps, selectedAt: "bad" },
        "exact UTC instant",
      );
      expectSelectionRefusal(
        "selection requires a canonical UTC instant",
        { ...selectionProps, selectedAt: "2026-08-28T12:00:02Z" },
        "exact UTC instant",
      );
      expectSelectionRefusal(
        "selection cannot precede candidate completion",
        { ...selectionProps, selectedAt: "2026-08-28T12:00:00.999Z" },
        "cannot precede the candidate completion instant",
      );
      for (const [label, props] of [
        ["selection reason is nonblank", { ...selectionProps, reason: " " }],
        [
          "selection reason is exactly trimmed",
          { ...selectionProps, reason: " padded" },
        ],
        [
          "selection structural review is nonblank",
          { ...selectionProps, structuralReview: " " },
        ],
        [
          "selection structural review is exactly trimmed",
          { ...selectionProps, structuralReview: "padded " },
        ],
        [
          "selection continuity baseline is nonblank",
          {
            ...selectionProps,
            continuityReview: { ...continuityReview, baseline: " " },
          },
        ],
        [
          "selection continuity baseline is exactly trimmed",
          {
            ...selectionProps,
            continuityReview: { ...continuityReview, baseline: " padded" },
          },
        ],
        [
          "selection playback evidence is nonblank",
          {
            ...selectionProps,
            continuityReview: { ...continuityReview, playbackEvidence: " " },
          },
        ],
        [
          "selection playback evidence is exactly trimmed",
          {
            ...selectionProps,
            continuityReview: {
              ...continuityReview,
              playbackEvidence: "padded ",
            },
          },
        ],
        [
          "selection mixed-delivery policy is nonblank when present",
          {
            ...selectionProps,
            continuityReview: {
              ...continuityReview,
              mixedDeliveryPolicy: " ",
            },
          },
        ],
        [
          "selection mixed-delivery policy is exactly trimmed",
          {
            ...selectionProps,
            continuityReview: {
              ...continuityReview,
              mixedDeliveryPolicy: "padded ",
            },
          },
        ],
      ] satisfies ReadonlyArray<
        readonly [string, Parameters<typeof project.selectRepaintCandidate>[0]]
      >)
        expectSelectionRefusal(label, props, "trimmed and non-empty");
      for (const field of [
        "flicker",
        "identityDrift",
        "geometryWarp",
        "textureCrawl",
        "transitionMismatch",
      ] as const)
        expectSelectionRefusal(
          `selection requires a passing ${field} observation`,
          {
            ...selectionProps,
            continuityReview: {
              ...continuityReview,
              [field]: "fail" as "pass",
            },
          },
          "requires passing flicker",
        );
      expectSelectionRefusal(
        "reversal requires a previous active selection",
        { ...selectionProps, kind: "reversal" },
        "requires an existing active verified selection",
      );

      project.selectRepaintCandidate(selectionProps);
      TestValidator.equals(
        "complete resident repaint receipt and MP4 enumerate once per unique shot",
        project.verifiedRepaintRenditions([shot, shot]),
        [validReceipt],
      );
      const initialPointer = JSON.parse(
        fs.readFileSync(activeFile, "utf8"),
      ) as { selection: string };
      const initialSelectionFile = project.trackedStatePath(
        initialPointer.selection,
      );
      const initialSelectionBytes = fs.readFileSync(initialSelectionFile);
      fs.rmSync(initialSelectionFile);
      expectSelectionRefusal(
        "ordinary selection refuses an unverifiable active pointer",
        selectionProps,
        "does not name an active verified selection",
      );
      fs.writeFileSync(initialSelectionFile, initialSelectionBytes);

      const laterAttemptId = "00000000-0000-4000-8000-000000000003";
      const laterOutputPath = productionRepaintOutputPath({
        shot,
        sourceRenderFingerprint,
        attemptId: laterAttemptId,
        adapterIdentity,
        generatorProvenance,
        parameters,
        executionPolicy,
        evidence,
        references,
        outputDigest,
      });
      const laterReceipt: IAutoMovieRepaintReceipt = {
        ...validReceipt,
        requestId: "00000000-0000-4000-8000-000000000021",
        attemptId: laterAttemptId,
        startedAt: "2026-08-28T12:00:02.000Z",
        completedAt: "2026-08-28T12:00:03.000Z",
        output: { ...validReceipt.output, path: laterOutputPath },
      };
      project.commitRepaintAttempt(succeededAttemptForReceipt(laterReceipt));
      project.commitRepaintRendition(laterReceipt, outputBytes);
      expectSelectionRefusal(
        "reversal cannot move from an earlier candidate to a later candidate",
        {
          ...selectionProps,
          attemptId: laterReceipt.attemptId,
          kind: "reversal",
          selectedAt: "2026-08-28T12:00:03.000Z",
        },
        "completed before the current active candidate",
      );
      project.selectRepaintCandidate({
        ...selectionProps,
        attemptId: laterReceipt.attemptId,
        selectedAt: "2026-08-28T12:00:04.000Z",
      });
      expectSelectionRefusal(
        "reversal cannot select the current candidate again",
        {
          ...selectionProps,
          attemptId: laterReceipt.attemptId,
          kind: "reversal",
          selectedAt: "2026-08-28T12:00:05.000Z",
        },
        "completed before the current active candidate",
      );

      const reversalProps = {
        ...selectionProps,
        kind: "reversal" as const,
        selectedAt: "2026-08-28T12:00:05.000Z",
      };

      const activeIdentity = fs.readFileSync(activeFile, "utf8");
      const selectionDirectory = project.trackedStatePath(
        `renditions/selections/${shot}`,
      );
      const selectionResidents = (): string[] =>
        fs
          .readdirSync(selectionDirectory)
          .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
      const residentsBeforeRace = selectionResidents();
      const selectedCandidateOutput = path.join(
        project.renderRoot(),
        validReceipt.output.path,
      );
      expectSelectionRefusal(
        "selection refuses a candidate that becomes stale before its guarded write",
        {
          ...reversalProps,
          inputCurrent: () => {
            fs.rmSync(selectedCandidateOutput);
            return true;
          },
        },
        "before the guarded commit began",
      );
      fs.writeFileSync(selectedCandidateOutput, outputBytes);
      TestValidator.equals(
        "pre-write candidate invalidation leaves selection state unchanged",
        {
          active: fs.readFileSync(activeFile, "utf8"),
          selections: selectionResidents(),
        },
        { active: activeIdentity, selections: residentsBeforeRace },
      );
      let candidateCurrentChecks = 0;
      expectSelectionRefusal(
        "selection rolls back when its candidate becomes stale after publication",
        {
          ...reversalProps,
          inputCurrent: () => {
            if (++candidateCurrentChecks === 2)
              fs.rmSync(selectedCandidateOutput);
            return true;
          },
        },
        "while the guarded commit was being applied",
      );
      fs.writeFileSync(selectedCandidateOutput, outputBytes);
      TestValidator.equals(
        "post-write candidate invalidation rolls selection state back",
        {
          active: fs.readFileSync(activeFile, "utf8"),
          checks: candidateCurrentChecks,
          selections: selectionResidents(),
        },
        {
          active: activeIdentity,
          checks: 2,
          selections: residentsBeforeRace,
        },
      );
      expectSelectionRefusal(
        "selection refuses a pre-write input race",
        { ...reversalProps, inputCurrent: () => false },
        "before the guarded commit began",
      );
      TestValidator.equals(
        "pre-write selection refusal leaves pointer and selection residents unchanged",
        {
          active: fs.readFileSync(activeFile, "utf8"),
          selections: selectionResidents(),
        },
        { active: activeIdentity, selections: residentsBeforeRace },
      );
      let currentChecks = 0;
      expectSelectionRefusal(
        "selection refuses a third post-write active-pointer identity",
        {
          ...reversalProps,
          inputCurrent: () => {
            currentChecks += 1;
            if (currentChecks === 2)
              fs.writeFileSync(activeFile, "third concurrent identity");
            return true;
          },
        },
        "while the guarded commit was being applied",
      );
      TestValidator.equals(
        "post-write selection refusal rolls back pointer and selection residents",
        {
          active: fs.readFileSync(activeFile, "utf8"),
          checks: currentChecks,
          selections: selectionResidents(),
        },
        {
          active: activeIdentity,
          checks: 2,
          selections: residentsBeforeRace,
        },
      );

      project.selectRepaintCandidate({
        ...reversalProps,
        reason: "Reverse to the already verified repaint candidate.",
        selectedAt: "2026-08-28T12:00:06.000Z",
      });
      const selectedPointer = JSON.parse(
        fs.readFileSync(activeFile, "utf8"),
      ) as { selection: string };
      type StoredSelection = {
        selectionId: string;
        kind: "selection" | "reversal";
        productionId: string;
        shot: string;
        requestId: string;
        attemptId: string;
        selectedAt: string;
        candidateReceipt: string;
        output: string;
        previousSelection: string | null;
        reason: string;
        structuralReview: string;
        continuityReview: typeof continuityReview | null;
      };
      const selectedSelection = JSON.parse(
        fs.readFileSync(
          project.trackedStatePath(selectedPointer.selection),
          "utf8",
        ),
      ) as StoredSelection;
      const expectStoredSelectionOmitted = (
        label: string,
        mutate: (selection: StoredSelection) => void,
      ): void => {
        const candidate = structuredClone(selectedSelection);
        mutate(candidate);
        writeTrackedJson(project, selectedPointer.selection, candidate);
        TestValidator.equals(
          label,
          project.verifiedRepaintRenditions([shot]),
          [],
        );
        writeTrackedJson(project, selectedPointer.selection, selectedSelection);
      };
      const otherId = "00000000-0000-4000-8000-000000000098";
      for (const [label, mutate] of [
        [
          "stored selection cannot precede candidate completion",
          (selection: StoredSelection): void => {
            selection.selectedAt = "2026-08-28T12:00:00.999Z";
          },
        ],
        [
          "stored selection refuses a foreign production",
          (selection: StoredSelection): void => {
            selection.productionId = "other-production";
          },
        ],
        [
          "stored selection refuses a foreign shot",
          (selection: StoredSelection): void => {
            selection.shot = "other-shot";
          },
        ],
        [
          "stored selection refuses a path that disagrees with its id",
          (selection: StoredSelection): void => {
            selection.selectionId = otherId;
          },
        ],
        [
          "stored selection refuses a foreign request",
          (selection: StoredSelection): void => {
            selection.requestId = otherId;
          },
        ],
        [
          "stored selection refuses a foreign attempt",
          (selection: StoredSelection): void => {
            selection.attemptId = otherId;
          },
        ],
        [
          "stored selection refuses a foreign candidate receipt",
          (selection: StoredSelection): void => {
            selection.candidateReceipt = "renditions/foreign.json";
          },
        ],
        [
          "stored selection refuses a foreign output",
          (selection: StoredSelection): void => {
            selection.output = "repaint/foreign.mp4";
          },
        ],
        [
          "stored selection reason is nonblank",
          (selection: StoredSelection): void => {
            selection.reason = " ";
          },
        ],
        [
          "stored selection reason is exactly trimmed",
          (selection: StoredSelection): void => {
            selection.reason = " padded";
          },
        ],
        [
          "stored structural review is nonblank",
          (selection: StoredSelection): void => {
            selection.structuralReview = " ";
          },
        ],
        [
          "stored structural review is exactly trimmed",
          (selection: StoredSelection): void => {
            selection.structuralReview = "padded ";
          },
        ],
        [
          "stored reversal retains its previous selection",
          (selection: StoredSelection): void => {
            selection.previousSelection = null;
          },
        ],
        [
          "stored narrative repaint retains continuity review",
          (selection: StoredSelection): void => {
            selection.continuityReview = null;
          },
        ],
        [
          "stored continuity baseline exactly matches receipt evidence",
          (selection: StoredSelection): void => {
            selection.continuityReview!.baseline = " padded";
          },
        ],
        [
          "stored playback evidence is nonblank",
          (selection: StoredSelection): void => {
            selection.continuityReview!.playbackEvidence = " ";
          },
        ],
        [
          "stored playback evidence is exactly trimmed",
          (selection: StoredSelection): void => {
            selection.continuityReview!.playbackEvidence = "padded ";
          },
        ],
        [
          "stored mixed-delivery policy is nonblank when present",
          (selection: StoredSelection): void => {
            selection.continuityReview!.mixedDeliveryPolicy = " ";
          },
        ],
        [
          "stored mixed-delivery policy is exactly trimmed",
          (selection: StoredSelection): void => {
            selection.continuityReview!.mixedDeliveryPolicy = "padded ";
          },
        ],
      ] as const)
        expectStoredSelectionOmitted(label, mutate);
      TestValidator.equals(
        "restored stored selection remains the exact active rendition",
        project.verifiedRepaintRenditions([shot]),
        [validReceipt],
      );

      const expectRefusal = (
        label: string,
        candidate: IAutoMovieRepaintReceipt,
        message: string,
        bytes: Uint8Array = outputBytes,
        bindAttempt: boolean = false,
      ): void => {
        try {
          if (bindAttempt)
            writeTrackedJson(
              project,
              validAttemptPath,
              succeededAttemptForReceipt(candidate),
            );
          project.commitRepaintRendition(candidate, bytes);
          throw new Error(`${label} unexpectedly committed.`);
        } catch (error) {
          TestValidator.predicate(
            label,
            error instanceof Error && error.message.includes(message),
          );
        } finally {
          if (bindAttempt)
            writeTrackedJson(project, validAttemptPath, validAttempt);
        }
      };
      const generatedManifestFile = project.trackedStatePath(
        "generated-manifest.json",
      );
      const generatedManifestBytes = fs.readFileSync(generatedManifestFile);
      fs.rmSync(generatedManifestFile);
      expectRefusal(
        "repaint refuses when the current generated manifest is absent",
        validReceipt,
        "current compiler input",
      );
      fs.writeFileSync(generatedManifestFile, generatedManifestBytes);
      expectRefusal(
        "repaint refuses a stale compiler fingerprint",
        {
          ...validReceipt,
          compileFingerprint: `sha256:${"f".repeat(64)}`,
        },
        "current compiler input",
      );
      expectRefusal(
        "repaint refuses a source bundle that is not verifiable",
        { ...validReceipt, sourceBundle: "missing/source/bundle" },
        "source evidence is stale",
      );

      const filmSourceManifest: IAutoMovieRenderBundleManifest = {
        ...sourceManifest,
        target: { kind: "film", id: "fixture-film" },
        targetFingerprint: digestAutoMovieBytes(
          Buffer.from("runtime-shape-film-target"),
        ),
      };
      const filmSourceBundle =
        productionRenderBundleRelativePath(filmSourceManifest);
      project.commitRenderBundle(
        filmSourceBundle,
        new Map([["depth-000000.png", frameBytes]]),
        filmSourceManifest,
      );
      expectRefusal(
        "repaint structural evidence must be owned by a shot render",
        {
          ...validReceipt,
          sourceBundle: filmSourceBundle,
          sourceRenderFingerprint: productionSourceRenderFingerprint({
            manifest: filmSourceManifest,
            frames: filmSourceManifest.frames,
          }),
          controls: productionRepaintStructuralControls(filmSourceManifest),
        },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint source evidence must name the receipt shot",
        { ...validReceipt, shot: "other-shot" },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint refuses a stale source-render fingerprint",
        {
          ...validReceipt,
          sourceRenderFingerprint: `sha256:${"e".repeat(64)}`,
        },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint refuses structural controls that differ from the source bundle",
        {
          ...validReceipt,
          controls: [
            {
              ...validReceipt.controls[0]!,
              frameDigests: [`sha256:${"d".repeat(64)}`],
            },
          ],
        },
        "source evidence is stale",
      );

      expectRefusal(
        "repaint refuses a non-JSON adapter identity",
        { ...validReceipt, adapterIdentity: "{broken" },
        "adapter identity is not JSON",
      );
      expectRefusal(
        "repaint refuses an adapter identity outside the strict runtime schema",
        { ...validReceipt, adapterIdentity: JSON.stringify({}) },
        "adapter identity is invalid",
      );
      expectRefusal(
        "repaint refuses a noncanonical serialization of a valid adapter identity",
        {
          ...validReceipt,
          adapterIdentity: JSON.stringify(
            JSON.parse(validReceipt.adapterIdentity),
            null,
            2,
          ),
        },
        "adapter identity is invalid",
      );
      expectRefusal(
        "repaint refuses an invalid stored execution policy",
        {
          ...validReceipt,
          executionPolicy: {
            ...validReceipt.executionPolicy!,
            maximumAttempts: 0,
          },
        },
        "execution policy requires",
      );
      expectRefusal(
        "repaint evidence requires nonblank fields",
        {
          ...validReceipt,
          evidence: { ...validReceipt.evidence!, prompt: " " },
        },
        "parameters are invalid",
      );
      expectRefusal(
        "repaint evidence fields are exactly trimmed",
        {
          ...validReceipt,
          evidence: { ...validReceipt.evidence!, settings: " padded " },
        },
        "parameters are invalid",
      );

      const assetBytes = fs.readFileSync(assetFile);
      fs.rmSync(assetFile);
      expectRefusal(
        "repaint references require the declared asset manifest",
        validReceipt,
        "current declared asset manifest",
      );
      fs.writeFileSync(assetFile, assetBytes);
      fs.writeFileSync(assetFile, "{broken");
      expectRefusal(
        "repaint refuses a malformed asset manifest",
        validReceipt,
        "not valid JSON",
      );
      fs.writeFileSync(
        assetFile,
        JSON.stringify({ version: 1, assets: "bad" }),
      );
      expectRefusal(
        "repaint refuses an asset manifest outside its strict schema",
        validReceipt,
        "strict schema",
      );
      fs.writeFileSync(assetFile, assetBytes);
      expectRefusal(
        "repaint requires at least one role-specific reference",
        { ...validReceipt, references: [] },
        "at least one fixed reference",
      );
      expectRefusal(
        "repaint refuses an exact duplicate role and path",
        {
          ...validReceipt,
          references: [
            validReceipt.references[0]!,
            validReceipt.references[0]!,
          ],
        },
        "duplicate, absent, byte-stale",
      );
      expectRefusal(
        "repaint refuses an unregistered reference path",
        {
          ...validReceipt,
          references: [
            {
              ...validReceipt.references[0]!,
              path: "public/assets/absent-reference.png",
            },
          ],
        },
        "duplicate, absent, byte-stale",
      );
      fs.rmSync(referenceFile);
      expectRefusal(
        "repaint refuses a registered reference whose bytes are absent",
        validReceipt,
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, referenceBytes);
      expectRefusal(
        "repaint refuses a reference digest that differs from its asset record",
        {
          ...validReceipt,
          references: [
            {
              ...validReceipt.references[0]!,
              digest: `sha256:${"c".repeat(64)}`,
            },
          ],
        },
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, Buffer.from("changed reference"));
      expectRefusal(
        "repaint refuses reference bytes that differ from the declared digest",
        validReceipt,
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, referenceBytes);
      const assetsWithoutUse = structuredClone(assets);
      assetsWithoutUse.assets.find(
        (asset) => asset.path === referencePath,
      )!.uses = [];
      fs.writeFileSync(
        assetFile,
        `${JSON.stringify(assetsWithoutUse, null, 2)}\n`,
      );
      expectRefusal(
        "repaint refuses a reference without the addressed shot use",
        validReceipt,
        "not registered to shot",
      );
      fs.writeFileSync(assetFile, assetBytes);
      expectRefusal(
        "one image cannot stand as canonical guidance for every repaint role",
        {
          ...validReceipt,
          references: [
            "structure",
            "character",
            "costume",
            "style",
            "material",
            "color",
            "environment",
          ].map((role) => ({
            ...validReceipt.references[0]!,
            role: role as IAutoMovieRepaintReceipt["references"][number]["role"],
          })),
        },
        "cannot stand as canonical guidance for every role",
      );

      expectRefusal(
        "repaint output identity refuses another production",
        { ...validReceipt, productionId: "other-production" },
        "immutable succeeded terminal attempt",
      );
      expectRefusal(
        "repaint output identity refuses a noncanonical path",
        {
          ...validReceipt,
          output: { ...validReceipt.output, path: "repaint/wrong.mp4" },
        },
        "output identity is invalid",
      );
      const wrongOutputDigest = `sha256:${"b".repeat(64)}` as const;
      const wrongDigestReceipt: IAutoMovieRepaintReceipt = {
        ...validReceipt,
        output: {
          ...validReceipt.output,
          digest: wrongOutputDigest,
          path: productionRepaintOutputPath({
            shot,
            sourceRenderFingerprint,
            attemptId: validReceipt.attemptId,
            adapterIdentity,
            generatorProvenance,
            parameters,
            executionPolicy,
            evidence,
            references,
            outputDigest: wrongOutputDigest,
          }),
        },
      };
      expectRefusal(
        "repaint output identity refuses a digest that differs from bytes",
        wrongDigestReceipt,
        "output identity is invalid",
        outputBytes,
        true,
      );
      expectRefusal(
        "repaint output identity refuses a byte-count mismatch",
        {
          ...validReceipt,
          output: {
            ...validReceipt.output,
            bytes: validReceipt.output.bytes + 1,
          },
        },
        "output identity is invalid",
        outputBytes,
        true,
      );
      const validVideoProbe = validReceipt.output.probe;
      if (validVideoProbe.kind !== "video")
        throw new Error("The valid repaint fixture must probe as video.");
      expectRefusal(
        "repaint refuses probe facts that differ from the parsed MP4",
        {
          ...validReceipt,
          output: {
            ...validReceipt.output,
            probe: { ...validVideoProbe, width: 17 },
          },
        },
        "media facts are stale",
      );

      const receiptForBytes = (
        mediaBytes: Uint8Array,
      ): IAutoMovieRepaintReceipt => {
        const digest = digestAutoMovieBytes(mediaBytes);
        return {
          ...validReceipt,
          output: {
            path: productionRepaintOutputPath({
              shot,
              sourceRenderFingerprint,
              attemptId: validReceipt.attemptId,
              adapterIdentity,
              generatorProvenance,
              parameters,
              executionPolicy,
              evidence,
              references,
              outputDigest: digest,
            }),
            digest,
            bytes: mediaBytes.length,
            probe: probeProductionVideoMp4(mediaBytes),
          },
        };
      };
      for (const [label, mediaBytes] of [
        [
          "repaint media width must equal the production raster",
          await productionH264Mp4({
            width: 8,
            height: 16,
            fps: 24,
            frameCount: 144,
          }),
        ],
        [
          "repaint media height must equal the production raster",
          await productionH264Mp4({
            width: 16,
            height: 8,
            fps: 24,
            frameCount: 144,
          }),
        ],
        [
          "repaint media fps must equal the production frame clock",
          await productionH264Mp4({
            width: 16,
            height: 16,
            fps: 12,
            frameCount: 72,
          }),
        ],
        [
          "repaint media frame count must equal the shot duration",
          await productionH264Mp4({
            width: 16,
            height: 16,
            fps: 24,
            frameCount: 143,
          }),
        ],
      ] as const)
        expectRefusal(
          label,
          receiptForBytes(mediaBytes),
          "media facts are stale",
          mediaBytes,
          true,
        );

      const productionDesignFile = path.join(
        fixture.root,
        project.designRecordPath({ kind: "production" }),
      );
      const productionDesignBytes = fs.readFileSync(productionDesignFile);
      fs.rmSync(productionDesignFile);
      expectRefusal(
        "repaint refuses when its production media target is absent",
        validReceipt,
        "media target is stale",
      );
      fs.writeFileSync(productionDesignFile, productionDesignBytes);
      const shotDesignFile = path.join(
        fixture.root,
        project.designRecordPath({ kind: "shot", id: shot }),
      );
      const shotDesignBytes = fs.readFileSync(shotDesignFile);
      fs.rmSync(shotDesignFile);
      expectRefusal(
        "repaint refuses when its shot media target is absent",
        validReceipt,
        "media target is stale",
      );
      fs.writeFileSync(shotDesignFile, shotDesignBytes);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      preserveRepaintRecordCleanup(failure, fixture.dispose);
    }
  };
