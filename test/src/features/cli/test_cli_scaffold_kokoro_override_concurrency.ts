import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

interface IKokoroOverrideModule {
  withKokoroRuntimeOverrides<Output>(
    overrides: Array<{
      resource: string;
      install(): unknown;
      restore(): unknown;
    }>,
    operation: () => Output | Promise<Output>,
  ): Promise<Output>;
}

const deferred = (): {
  promise: Promise<null>;
  resolve(): void;
} => {
  let release = (): void => undefined;
  const promise = new Promise<null>((resolve) => {
    release = () => resolve(null);
  });
  return { promise, resolve: release };
};

/**
 * Kokoro's unavoidable process overrides serialize across generated copies.
 *
 * Scenarios:
 *
 * 1. Two operations start concurrently and observe a strict A
 *    install/operation/restore then B
 *    install/operation/restore sequence through one process coordination slot.
 * 2. Both shared globals return to their original object/value identity after
 *    the concurrent calls, proving the slot contains coordination only.
 * 3. An operation failure plus restoration failure preserves primary then
 *    cleanup order and primary cause, releases the FIFO permit, and allows a
 *    subsequent call from the other physical copy to restore globals again.
 */
export const test_cli_scaffold_kokoro_override_concurrency =
  async (): Promise<void> => {
    const loader = createRequire(__filename);
    const source = path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/withKokoroRuntimeOverrides.ts",
    );
    const runtime = loader(source) as IKokoroOverrideModule;
    const initialFetch = globalThis.fetch;
    const environment = { cacheDir: "initial" };
    try {
      const fetchA = (() =>
        Promise.reject(new Error("unused A fetch"))) as typeof fetch;
      const fetchB = (() =>
        Promise.reject(new Error("unused B fetch"))) as typeof fetch;
      const events: string[] = [];
      const enteredA = deferred();
      const releaseA = deferred();
      const call = (
        module: IKokoroOverrideModule,
        name: "A" | "B",
        selectedFetch: typeof fetch,
      ): Promise<string> =>
        module.withKokoroRuntimeOverrides(
          [
            {
              resource: `${name} cache`,
              install: () => {
                events.push(`${name}.install.cache`);
                environment.cacheDir = name;
              },
              restore: () => {
                events.push(`${name}.restore.cache`);
                environment.cacheDir = "initial";
              },
            },
            {
              resource: `${name} fetch`,
              install: () => {
                events.push(`${name}.install.fetch`);
                globalThis.fetch = selectedFetch;
              },
              restore: () => {
                events.push(`${name}.restore.fetch`);
                globalThis.fetch = initialFetch;
              },
            },
          ],
          async () => {
            events.push(`${name}.operation.start`);
            if (name === "A") {
              enteredA.resolve();
              await releaseA.promise;
            }
            TestValidator.equals(
              `${name} owns both globals throughout its operation`,
              {
                cache: environment.cacheDir,
                fetch: globalThis.fetch === selectedFetch,
              },
              { cache: name, fetch: true },
            );
            events.push(`${name}.operation.complete`);
            return name;
          },
        );
      const firstCall = call(runtime, "A", fetchA);
      await enteredA.promise;
      const secondCall = call(runtime, "B", fetchB);
      await Promise.resolve();
      TestValidator.equals(
        "the second physical copy waits without installing an override",
        events,
        ["A.install.cache", "A.install.fetch", "A.operation.start"],
      );
      releaseA.resolve();
      TestValidator.equals(
        "both physical copies complete in strict FIFO order",
        await Promise.all([firstCall, secondCall]),
        ["A", "B"],
      );
      TestValidator.equals(
        "the serialized operation and restoration order is exact",
        events,
        [
          "A.install.cache",
          "A.install.fetch",
          "A.operation.start",
          "A.operation.complete",
          "A.restore.cache",
          "A.restore.fetch",
          "B.install.cache",
          "B.install.fetch",
          "B.operation.start",
          "B.operation.complete",
          "B.restore.cache",
          "B.restore.fetch",
        ],
      );
      TestValidator.equals(
        "the original globals are restored after both copies",
        {
          cache: environment.cacheDir,
          fetchIdentity: globalThis.fetch === initialFetch,
        },
        { cache: "initial", fetchIdentity: true },
      );

      const primary = new Error("Kokoro operation failed");
      const cleanup = new Error("Kokoro fetch restoration failed");
      let combined: unknown;
      try {
        await runtime.withKokoroRuntimeOverrides(
          [
            {
              resource: "failing fetch",
              install: () => {
                globalThis.fetch = fetchA;
              },
              restore: () => {
                globalThis.fetch = initialFetch;
                throw cleanup;
              },
            },
          ],
          () => {
            throw primary;
          },
        );
      } catch (error) {
        combined = error;
      }
      const errors =
        combined instanceof AggregateError ? [...combined.errors] : [];
      const recovery = await runtime.withKokoroRuntimeOverrides(
        [
          {
            resource: "recovery fetch",
            install: () => {
              globalThis.fetch = fetchB;
            },
            restore: () => {
              globalThis.fetch = initialFetch;
            },
          },
        ],
        () => globalThis.fetch === fetchB,
      );
      TestValidator.equals(
        "failure order, permit release, and final global restoration are exact",
        {
          aggregate: combined instanceof AggregateError,
          cause:
            combined instanceof AggregateError ? combined.cause : undefined,
          errors,
          recovery,
          restored: globalThis.fetch === initialFetch,
        },
        {
          aggregate: true,
          cause: primary,
          errors: [primary, cleanup],
          recovery: true,
          restored: true,
        },
      );
    } finally {
      globalThis.fetch = initialFetch;
    }
  };
