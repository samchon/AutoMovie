import {
  AutoMovieRepaintRecordInspectionError,
  inspectAutoMovieRepaintRecords,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Repaint inspection preserves valid siblings and exact safe failure classes.
 *
 * Scenarios:
 *
 * 1. Valid candidates and renditions survive failures in unrelated records.
 * 2. Absence, typed schema/stale/unsafe/corrupt failures and hostile reads each
 *    retain a deterministic target, stage, class and credential-free recovery.
 */
export const test_production_repaint_record_inspection = (): void => {
  const targets = [
    { kind: "rendition" as const, shot: "b", recordId: "valid-b" },
    { kind: "candidate" as const, shot: "a", recordId: "missing" },
    { kind: "candidate" as const, shot: "a", recordId: "linked-missing" },
    { kind: "candidate" as const, shot: "a", recordId: "unavailable" },
    { kind: "candidate" as const, shot: "b", recordId: "valid-a" },
    { kind: "candidate" as const, shot: "a", recordId: "stale" },
    { kind: "candidate" as const, shot: "a", recordId: "schema" },
    { kind: "candidate" as const, shot: "a", recordId: "identity" },
    { kind: "rendition" as const, shot: "a", recordId: "unsafe" },
    { kind: "rendition" as const, shot: "a", recordId: "corrupt" },
    { kind: "rendition" as const, shot: "c", recordId: "hostile" },
  ];
  const result = inspectAutoMovieRepaintRecords({
    targets,
    inspect: (target) => {
      if (target.recordId.startsWith("valid")) return target.recordId;
      if (target.recordId === "missing") return null;
      if (target.recordId === "linked-missing")
        throw new AutoMovieRepaintRecordInspectionError("selection", "absent");
      if (target.recordId === "unavailable")
        throw new AutoMovieRepaintRecordInspectionError(
          "receipt",
          "unavailable",
        );
      if (target.recordId === "stale")
        throw Object.assign(
          new AutoMovieRepaintRecordInspectionError("currentness", "stale"),
          { recovery: "secret-token" },
        );
      if (target.recordId === "schema")
        throw new AutoMovieRepaintRecordInspectionError(
          "receipt",
          "schema-invalid",
        );
      if (target.recordId === "identity")
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          "identity-invalid",
        );
      if (target.recordId === "unsafe")
        throw new AutoMovieRepaintRecordInspectionError(
          "pointer",
          "unsafe-locator",
        );
      if (target.recordId === "corrupt")
        throw new AutoMovieRepaintRecordInspectionError(
          "output",
          "render-corrupt",
        );
      throw new Proxy(
        {},
        {
          getPrototypeOf: () => {
            throw new Error("secret-token");
          },
        },
      );
    },
  });
  TestValidator.equals(
    "valid siblings and deterministic classified findings survive together",
    {
      records: result.records.map(({ target, value }) => [
        target.shot,
        target.recordId,
        value,
      ]),
      findings: result.findings.map((finding) => ({
        shot: finding.target.shot,
        record: finding.target.recordId,
        stage: finding.stage,
        failure: finding.failure,
        leaksSecret: finding.recovery.includes("secret-token"),
      })),
    },
    {
      records: [
        ["b", "valid-a", "valid-a"],
        ["b", "valid-b", "valid-b"],
      ],
      findings: [
        {
          shot: "a",
          record: "identity",
          stage: "selection",
          failure: "identity-invalid",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "linked-missing",
          stage: "selection",
          failure: "absent",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "missing",
          stage: "receipt",
          failure: "absent",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "schema",
          stage: "receipt",
          failure: "schema-invalid",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "stale",
          stage: "currentness",
          failure: "stale",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "unavailable",
          stage: "receipt",
          failure: "unavailable",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "corrupt",
          stage: "output",
          failure: "render-corrupt",
          leaksSecret: false,
        },
        {
          shot: "a",
          record: "unsafe",
          stage: "pointer",
          failure: "unsafe-locator",
          leaksSecret: false,
        },
        {
          shot: "c",
          record: "hostile",
          stage: "enumeration",
          failure: "unavailable",
          leaksSecret: false,
        },
      ],
    },
  );
  TestValidator.predicate(
    "malformed target is refused before any reader call",
    throwsError(() =>
      inspectAutoMovieRepaintRecords({
        targets: [{ kind: "candidate", shot: " ", recordId: "x" }],
        inspect: () => "unreachable",
      }),
    ),
  );
};
