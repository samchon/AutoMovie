import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

import { namedFacts } from "../internal/predicates";

interface IKokoroRuntimeOverrideModule {
  withKokoroRuntimeOverrides<Output>(
    overrides: readonly {
      resource: string;
      install: () => unknown;
      restore: () => unknown;
    }[],
    operation: () => Output | Promise<Output>,
  ): Promise<Output>;
}

interface IKokoroOverrideCapture {
  caught: unknown;
  order: string[];
  output: unknown;
}

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * The scaffold's Kokoro override policy restores every attempted resource and
 * preserves the failures that made loading or restoration fail.
 *
 * Scenarios:
 *
 * 1. Successful installation runs the operation and restores both resources in
 *    deterministic order.
 * 2. Partial setup failure withholds the operation result, restores every
 *    attempted resource, and preserves the setup failure.
 * 3. Operation failure survives successful restoration.
 * 4. One restoration failure is rethrown directly, while multiple restoration
 *    failures are aggregated in restoration order.
 * 5. An operation failure followed by restoration failures is aggregated with the
 *    primary failure first.
 */
const CHILD_ENV = "AUTOMOVIE_KOKORO_OVERRIDE_CHILD";

const assertKokoroRuntimeOverrides = async (): Promise<void> => {
  const source = path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/withKokoroRuntimeOverrides.ts",
  );
  const { withKokoroRuntimeOverrides } = (await tsImport(
    pathToFileURL(source).href,
    {
      parentURL: pathToFileURL(__filename).href,
      tsconfig: false,
    },
  )) as IKokoroRuntimeOverrideModule;
  const setupFailure = new Error("Kokoro override setup failed");
  const operationFailure = new Error("Kokoro load failed");
  const firstRestorationFailure = new Error("cache restoration failed");
  const secondRestorationFailure = new Error("fetch restoration failed");
  const capture = async (props: {
    installFailure?: Error;
    operationFailure?: Error;
    restorationFailures?: readonly (Error | undefined)[];
  }): Promise<IKokoroOverrideCapture> => {
    const order: string[] = [];
    let caught: unknown;
    let output: unknown;
    try {
      output = await withKokoroRuntimeOverrides(
        [0, 1].map((index) => ({
          resource: `override-${index}`,
          install: (): void => {
            order.push(`install-${index}`);
            if (index === 1 && props.installFailure !== undefined)
              throw props.installFailure;
          },
          restore: (): void => {
            order.push(`restore-${index}`);
            const restorationFailure = props.restorationFailures?.[index];
            if (restorationFailure !== undefined) throw restorationFailure;
          },
        })),
        () => {
          order.push("operation");
          if (props.operationFailure !== undefined)
            throw props.operationFailure;
          return "loaded runtime";
        },
      );
    } catch (error) {
      caught = error;
    }
    return { caught, order, output };
  };
  const success = await capture({});
  const setupOnly = await capture({ installFailure: setupFailure });
  const operationOnly = await capture({ operationFailure });
  const standaloneRestoration = await capture({
    restorationFailures: [firstRestorationFailure],
  });
  const multipleRestorations = await capture({
    restorationFailures: [firstRestorationFailure, secondRestorationFailure],
  });
  const combined = await capture({
    operationFailure,
    restorationFailures: [firstRestorationFailure, secondRestorationFailure],
  });
  const completedOrder = "install-0,install-1,operation,restore-0,restore-1";
  const setupOrder = "install-0,install-1,restore-0,restore-1";
  TestValidator.equals(
    "Kokoro override policy rolls back partial setup and preserves every failure",
    namedFacts([
      ["successOutput", () => success.output === "loaded runtime"],
      ["successSilent", () => success.caught === undefined],
      ["successOrder", () => success.order.join(",") === completedOrder],
      ["setupOnlyWithheldOutput", () => setupOnly.output === undefined],
      ["setupOnlyPreserved", () => setupOnly.caught === setupFailure],
      ["setupOnlyRolledBack", () => setupOnly.order.join(",") === setupOrder],
      ["operationPreserved", () => operationOnly.caught === operationFailure],
      [
        "operationOrder",
        () => operationOnly.order.join(",") === completedOrder,
      ],
      [
        "singleRestorationPreserved",
        () => standaloneRestoration.caught === firstRestorationFailure,
      ],
      [
        "singleRestorationOrder",
        () => standaloneRestoration.order.join(",") === completedOrder,
      ],
      [
        "multipleRestorationsAggregated",
        () =>
          aggregateContainsExactly(multipleRestorations.caught, [
            firstRestorationFailure,
            secondRestorationFailure,
          ]),
      ],
      [
        "multipleRestorationsOrder",
        () => multipleRestorations.order.join(",") === completedOrder,
      ],
      [
        "combinedAggregated",
        () =>
          aggregateContainsExactly(combined.caught, [
            operationFailure,
            firstRestorationFailure,
            secondRestorationFailure,
          ]),
      ],
      ["combinedOrder", () => combined.order.join(",") === completedOrder],
    ]),
    {
      successOutput: true,
      successSilent: true,
      successOrder: true,
      setupOnlyWithheldOutput: true,
      setupOnlyPreserved: true,
      setupOnlyRolledBack: true,
      operationPreserved: true,
      operationOrder: true,
      singleRestorationPreserved: true,
      singleRestorationOrder: true,
      multipleRestorationsAggregated: true,
      multipleRestorationsOrder: true,
      combinedAggregated: true,
      combinedOrder: true,
    },
  );
};

/** Exercise the shipped typed helper through a fresh TypeScript consumer. */
export const test_cli_kokoro_runtime_overrides = (): void => {
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
      `Kokoro-override typed consumer failed (${String(child.status)}):\n${child.stdout}${child.stderr}`,
    );
};

if (process.env[CHILD_ENV] === "1")
  void assertKokoroRuntimeOverrides().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
