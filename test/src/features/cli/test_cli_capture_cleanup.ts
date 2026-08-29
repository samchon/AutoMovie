import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

import { namedFacts } from "../internal/predicates";

interface IEncoderCleanupModule {
  preserveProductionEncoderCleanup(
    failure: { error: unknown } | undefined,
    resources: readonly { resource: string; cleanup: () => unknown }[],
  ): void;
}

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

interface IEncoderCleanupCapture {
  caught: unknown;
  order: number[];
}

/**
 * The shipped encoder cleanup helper retains the operation failure and every
 * release failure in deterministic resource order.
 */
const CHILD_ENV = "AUTOMOVIE_CAPTURE_CLEANUP_CHILD";

const assertCaptureCleanup = async (): Promise<void> => {
  const source = path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/preserveProductionEncoderCleanup.ts",
  );
  const { preserveProductionEncoderCleanup } = (await tsImport(
    pathToFileURL(source).href,
    {
      parentURL: pathToFileURL(__filename).href,
      tsconfig: false,
    },
  )) as IEncoderCleanupModule;
  const primaryFailure = new Error("encoder primary failure");
  const firstCleanupFailure = new Error("first encoder cleanup failure");
  const secondCleanupFailure = new Error("second encoder cleanup failure");
  const capture = (
    failure: { error: unknown } | undefined,
    cleanupFailures: readonly Error[],
  ): IEncoderCleanupCapture => {
    const order: number[] = [];
    let caught: unknown;
    try {
      preserveProductionEncoderCleanup(
        failure,
        [0, 1].map((index) => ({
          resource: `encoder-${index}`,
          cleanup: (): void => {
            order.push(index);
            const cleanupFailure = cleanupFailures[index];
            if (cleanupFailure !== undefined) throw cleanupFailure;
          },
        })),
      );
    } catch (error) {
      caught = error;
    }
    return { caught, order };
  };
  const success = capture(undefined, []);
  const primaryOnly = capture({ error: primaryFailure }, []);
  const standaloneSingle = capture(undefined, [firstCleanupFailure]);
  const standaloneMultiple = capture(undefined, [
    firstCleanupFailure,
    secondCleanupFailure,
  ]);
  const combined = capture({ error: primaryFailure }, [
    firstCleanupFailure,
    secondCleanupFailure,
  ]);
  TestValidator.equals(
    "scaffold encoder cleanup preserves every exact failure in resource order",
    namedFacts([
      ["successSilent", () => success.caught === undefined],
      ["successOrder", () => success.order.join(",") === "0,1"],
      ["primaryOnlyPreserved", () => primaryOnly.caught === primaryFailure],
      ["primaryOnlyOrder", () => primaryOnly.order.join(",") === "0,1"],
      [
        "singleReleasePreserved",
        () => standaloneSingle.caught === firstCleanupFailure,
      ],
      ["singleReleaseOrder", () => standaloneSingle.order.join(",") === "0,1"],
      [
        "multipleReleasesAggregated",
        () =>
          aggregateContainsExactly(standaloneMultiple.caught, [
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      [
        "multipleReleasesOrder",
        () => standaloneMultiple.order.join(",") === "0,1",
      ],
      [
        "combinedAggregated",
        () =>
          aggregateContainsExactly(combined.caught, [
            primaryFailure,
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      ["combinedOrder", () => combined.order.join(",") === "0,1"],
    ]),
    {
      successSilent: true,
      successOrder: true,
      primaryOnlyPreserved: true,
      primaryOnlyOrder: true,
      singleReleasePreserved: true,
      singleReleaseOrder: true,
      multipleReleasesAggregated: true,
      multipleReleasesOrder: true,
      combinedAggregated: true,
      combinedOrder: true,
    },
  );
};

/** Exercise the shipped typed helper through a fresh TypeScript consumer. */
export const test_cli_capture_cleanup = (): void => {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_OPTIONS;
  const child = spawnSync(
    process.execPath,
    [createRequire(__filename).resolve("tsx/cli"), __filename],
    {
      encoding: "utf8",
      env: { ...childEnvironment, [CHILD_ENV]: "1" },
    },
  );
  if (child.status !== 0)
    throw new Error(
      `capture-cleanup typed consumer failed (${String(child.status)}):\n${child.stdout}${child.stderr}`,
    );
};

if (process.env[CHILD_ENV] === "1")
  void assertCaptureCleanup().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
