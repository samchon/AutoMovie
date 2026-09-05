import type {
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionRenderLedgerSchemaError,
  AutoMovieStructuredJsonError,
  assertProductionRenderManifestRecord,
  assertProductionRenderReceiptRecord,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  parseProductionRenderManifestBytes,
  parseProductionRenderReceiptBytes,
  productionRenderPublicationIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";
import { renderJobPlanFixture } from "./renderJobPlanFixtures";

const plan = renderJobPlanFixture("final");
const identity = productionRenderPublicationIdentity(plan);
const manifest: IAutoMovieProductionRenderManifest = {
  version: 2,
  compileFingerprint: plan.compileFingerprint,
  publication: identity,
  deliverables: [],
};
const receiptFor = (
  manifestBytes: Uint8Array,
): IAutoMovieProductionRenderReceipt => ({
  version: 4,
  manifestDigest: digestAutoMovieBytes(manifestBytes),
  publicationFingerprint: identity.fingerprint,
  files: [],
});
const manifestBytes = canonicalAutoMovieJsonBytes(manifest);
const receipt = receiptFor(manifestBytes);
const receiptBytes = canonicalAutoMovieJsonBytes(receipt);
const same = (left: unknown, right: unknown): boolean =>
  Buffer.from(canonicalAutoMovieJsonBytes(left)).equals(
    Buffer.from(canonicalAutoMovieJsonBytes(right)),
  );
const schemaRefusal = (
  task: () => unknown,
  record: AutoMovieProductionRenderLedgerSchemaError["record"],
  violationIncludes: string,
  absentFromMessage: string | null = null,
): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof AutoMovieProductionRenderLedgerSchemaError &&
      error.code === "automovie-render-ledger-schema-invalid" &&
      error.record === record &&
      error.violations.some((violation) =>
        violation.includes(violationIncludes),
      ) &&
      error.message.includes(record) &&
      (absentFromMessage === null ||
        error.message.includes(absentFromMessage) === false)
    );
  }
};
const ingressRefusal = (
  task: () => unknown,
  record: string,
  stage: AutoMovieStructuredJsonError["stage"],
): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof AutoMovieStructuredJsonError &&
      error.record === record &&
      error.stage === stage
    );
  }
};

/**
 * The render manifest and renderer receipt are admitted through one
 * production-owned path that generated-project scripts and the compiler share.
 *
 * Scenarios:
 *
 * 1. Persisted manifest and receipt bytes round-trip through strict structured
 *    JSON ingress into their exact typed records, and an already materialized
 *    value is admitted by the same schema.
 * 2. A record that is not its schema is refused with the ledger record name
 *    and the violating schema path, and the stored value never enters the
 *    refusal, so a credential-bearing forgery cannot echo itself.
 * 3. A duplicate member or malformed UTF-8 is refused by the structured JSON
 *    stage under the ledger record's own name before any schema judgement.
 * 4. The final compiler reads the tracked manifest through the same admission:
 *    bytes that are not one structured JSON document report the JSON refusal,
 *    and a manifest that is not its schema reports the schema position, both
 *    as the deliverable-invalid diagnostic rather than a thrown error.
 */
export const test_production_render_ledger_admission = (): void => {
  TestValidator.equals(
    "ledger records admit through one typed path and refuse by cause",
    namedFacts([
      [
        "manifestRoundTrip",
        () => same(parseProductionRenderManifestBytes(manifestBytes), manifest),
      ],
      [
        "receiptRoundTrip",
        () => same(parseProductionRenderReceiptBytes(receiptBytes), receipt),
      ],
      [
        "valueAdmission",
        () =>
          same(assertProductionRenderManifestRecord(manifest), manifest) &&
          same(assertProductionRenderReceiptRecord(receipt), receipt),
      ],
      [
        "manifestSchemaViolationHidesValue",
        () =>
          schemaRefusal(
            () =>
              parseProductionRenderManifestBytes(
                canonicalAutoMovieJsonBytes({
                  ...manifest,
                  secretToken: "hunter2-credential",
                }),
              ),
            "render-manifest",
            "secretToken",
            "hunter2",
          ),
      ],
      [
        "receiptSchemaViolation",
        () =>
          schemaRefusal(
            () =>
              parseProductionRenderReceiptBytes(
                canonicalAutoMovieJsonBytes({ ...receipt, version: 3 }),
              ),
            "render-manifest-receipt",
            "version",
          ),
      ],
      [
        "nonObjectValue",
        () =>
          schemaRefusal(
            () => assertProductionRenderReceiptRecord("receipt"),
            "render-manifest-receipt",
            "$input",
          ),
      ],
      [
        "duplicateMember",
        () =>
          ingressRefusal(
            () =>
              parseProductionRenderManifestBytes(
                Buffer.from('{"version":2,"version":2}'),
              ),
            "render-manifest",
            "duplicate",
          ),
      ],
      [
        "malformedEncoding",
        () =>
          ingressRefusal(
            () => parseProductionRenderReceiptBytes(Buffer.from([0xff, 0xfe])),
            "render-manifest-receipt",
            "encoding",
          ),
      ],
    ]),
    {
      manifestRoundTrip: true,
      receiptRoundTrip: true,
      valueAdmission: true,
      manifestSchemaViolationHidesValue: true,
      receiptSchemaViolation: true,
      nonObjectValue: true,
      duplicateMember: true,
      malformedEncoding: true,
    },
  );

  const fixture = productionFixture();
  try {
    const invalidDiagnostics = (bytes: Uint8Array): string[] => {
      const project = AutoMovieProductionProject.open(
        fixture.root,
        "fixture-film",
      );
      const manifestPath = project.trackedStatePath("render-manifest.json");
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, bytes);
      fs.writeFileSync(
        project.trackedStatePath("render-manifest-receipt.json"),
        canonicalAutoMovieJsonBytes(receiptFor(bytes)),
      );
      return new AutoMovieProductionCompiler(
        project,
        undefined,
        undefined,
        plan,
      )
        .compile({ scope: "final" })
        .diagnostics.filter(
          (diagnostic) => diagnostic.code === "render-deliverable-invalid",
        )
        .map((diagnostic) => diagnostic.message);
    };
    const malformed = invalidDiagnostics(
      Buffer.from('{"version":2,"version":2}'),
    );
    const foreignSchema = invalidDiagnostics(
      canonicalAutoMovieJsonBytes({ ...manifest, version: 3 }),
    );
    TestValidator.equals(
      "the final compiler reports manifest admission refusals by cause",
      namedFacts([
        [
          "malformedJsonIsOneDiagnostic",
          () =>
            malformed.length === 1 &&
            malformed[0]!.includes("is not valid JSON"),
        ],
        [
          "foreignSchemaNamesThePosition",
          () =>
            foreignSchema.length === 1 &&
            foreignSchema[0]!.includes(
              "does not satisfy the aggregate render-ledger schema",
            ) &&
            foreignSchema[0]!.includes("$input.version"),
        ],
      ]),
      {
        malformedJsonIsOneDiagnostic: true,
        foreignSchemaNamesThePosition: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
