import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";

interface IPlan {
  compileFingerprint: string;
  runtimeIdentity: { generation: string };
  chunks: Array<{ id: string; slot: string }>;
}

interface IInputs {
  runtimeIdentity: { generation: string };
  sourceFingerprints: Record<string, string>;
}

type Inspection =
  | {
      status: "current";
      inputs: IInputs;
      assertCurrent(): Promise<void>;
      resources: Array<{ cleanup(): unknown; resource: string }>;
    }
  | {
      status: "not-ready" | "not-run";
      correction: string;
      assertCurrent(): Promise<void>;
      resources: Array<{ cleanup(): unknown; resource: string }>;
    };

interface IReadOnlyRuntime {
  inspectCurrentProductionRender(runtime: Runtime): Promise<
    | {
        status: "current";
        plan: IPlan;
        inputs: IInputs;
        assertCurrent(): Promise<void>;
        resources: Array<{ cleanup(): unknown; resource: string }>;
      }
    | { status: "stale"; plan: IPlan; correction: string }
  >;
  reportProductionRenderStatus(runtime: Runtime): Promise<void>;
  verifyCurrentProductionRender(runtime: Runtime): Promise<void>;
}

interface Runtime {
  assertPlanCurrent(plan: IPlan): unknown;
  inspectInputs(plan: IPlan): Inspection | Promise<Inspection>;
  output(value: unknown): void;
  readPlan(): IPlan;
  renderStatus(plan: IPlan): Array<{ status: string }>;
  runtimeIdentitiesEqual(left: unknown, right: unknown): boolean;
  sourceFingerprint(): string;
  staleRows(
    plan: IPlan,
    correction: string,
    runtimeComparison: "not-ready" | "not-run" | "stale",
  ): unknown;
  verifyPlan(props: { plan: IPlan } & IInputs): void;
}

interface IFixtureCensusEntry {
  digest: string | null;
  path: string;
  type: "directory" | "file" | "link";
}

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

const runtimeRoot = (): { preserve: boolean; root: string } => {
  const configured = process.env.AUTOMOVIE_ISSUE_2143_RUNTIME_ROOT;
  if (configured === undefined)
    return {
      preserve: false,
      root: fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-render-read-only-status-"),
      ),
    };
  const root = path.resolve(configured);
  const cache = path.join(REPOSITORY_ROOT, "node_modules/.cache");
  const relative = path.relative(cache, root);
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  )
    throw new Error(
      "The retained read-only status fixture must be a dedicated child of node_modules/.cache.",
    );
  fs.rmSync(root, { force: true, recursive: true });
  fs.mkdirSync(root, { recursive: true });
  return { preserve: true, root };
};

const census = (root: string, directory = root): IFixtureCensusEntry[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry): IFixtureCensusEntry[] => {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target).split(path.sep).join("/");
      if (entry.isSymbolicLink())
        return [{ digest: null, path: relative, type: "link" }];
      if (entry.isDirectory())
        return [
          { digest: null, path: `${relative}/`, type: "directory" },
          ...census(root, target),
        ];
      return [
        {
          digest: createHash("sha256")
            .update(fs.readFileSync(target))
            .digest("hex"),
          path: relative,
          type: "file",
        },
      ];
    });

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Render status and verify consume only existing evidence and never repair it.
 *
 * Scenarios:
 *
 * 1. A source-stale plan returns before runtime inspection and reports stale
 *    chunk rows without changing the generated project's exact byte census.
 * 2. Missing read-only runtime evidence makes status name the one materializing
 *    correction without throwing or changing process exit state.
 * 3. Verify refuses the same missing evidence with that exact correction.
 * 4. Unobserved graphics identity remains explicitly `not-run` and is never
 *    reconstructed from a stored full identity.
 * 5. Runtime drift and a plan inconsistent with current non-runtime inputs are
 *    distinct stale results, and neither reaches chunk inspection.
 * 6. Input-generation races both before and after plan validation close their
 *    resident resources and publish nothing.
 * 7. Complete sealed evidence reports current chunks and verify publishes one
 *    success result without calling fetch or any materializing trap.
 * 8. A current plan with one incomplete chunk is refused only by verify.
 * 9. A foreign plan successor or runtime generation arriving during chunk
 *    inspection publishes no current result.
 * 10. Primary, generation, and cleanup failures retain primary-first identity,
 *    cause, and ordering; cleanup-only failures remain exact.
 * 11. The generated consumer's module bytes equal the scaffold source exactly.
 */
export const test_cli_scaffold_render_read_only_status =
  async (): Promise<void> => {
    const fixture = runtimeRoot();
    const root = fixture.root;
    let failure: { error: unknown } | undefined;
    const originalFetch = globalThis.fetch;
    try {
      const rendered = renderScaffold({ name: "render-read-only-status" });
      writeFiles(root, rendered);
      const relative = "scripts/renderReadOnlyRuntime.ts";
      const source = fs.readFileSync(
        path.join(REPOSITORY_ROOT, "packages/template/scaffold", relative),
        "utf8",
      );
      const generated = fs.readFileSync(path.join(root, relative), "utf8");
      const module = (await import(
        `${pathToFileURL(path.join(root, relative)).href}?read-only-contract`
      )) as IReadOnlyRuntime;
      const plan: IPlan = {
        compileFingerprint: "source-a",
        runtimeIdentity: { generation: "runtime-a" },
        chunks: [{ id: "chunk-a", slot: "slot-a" }],
      };
      const inputs: IInputs = {
        runtimeIdentity: { generation: "runtime-a" },
        sourceFingerprints: { opening: "shot-a" },
      };
      let sourceFingerprint = "source-a";
      let currentAssertions = 0;
      let resourceCleanups = 0;
      const resourceFailure: { error: Error | null } = { error: null };
      const inspectionResources = () => [
        {
          resource: "read-only descriptor",
          cleanup: () => {
            ++resourceCleanups;
            if (resourceFailure.error !== null) throw resourceFailure.error;
          },
        },
      ];
      const currentInspection = (currentInputs: IInputs): Inspection => ({
        status: "current",
        inputs: currentInputs,
        assertCurrent: (): Promise<void> => {
          ++currentAssertions;
          return Promise.resolve();
        },
        resources: inspectionResources(),
      });
      let inspection: Inspection = currentInspection(inputs);
      let invalidPlan = false;
      let rows: Array<{ status: string }> = [{ status: "complete" }];
      const statusState: { failure: Error | null } = { failure: null };
      let fetchCalls = 0;
      let inspectCalls = 0;
      let statusCalls = 0;
      let verifyCalls = 0;
      let planGeneration = "plan-a";
      let observedPlanGeneration = planGeneration;
      let replacePlanDuringStatus = false;
      const foreignPlanSuccessor = new Error(
        "stored render plan acquired a foreign successor",
      );
      const outputs: unknown[] = [];
      globalThis.fetch = (() => {
        ++fetchCalls;
        throw new Error("Read-only render inspection must not fetch.");
      }) as typeof fetch;
      const runtime: Runtime = {
        assertPlanCurrent: () => {
          if (planGeneration !== observedPlanGeneration)
            throw foreignPlanSuccessor;
        },
        inspectInputs: () => {
          ++inspectCalls;
          return inspection;
        },
        output: (value) => outputs.push(value),
        readPlan: () => {
          observedPlanGeneration = planGeneration;
          return plan;
        },
        renderStatus: () => {
          ++statusCalls;
          if (statusState.failure !== null) throw statusState.failure;
          if (replacePlanDuringStatus) planGeneration = "plan-b";
          return rows;
        },
        runtimeIdentitiesEqual: isDeepStrictEqual,
        sourceFingerprint: () => sourceFingerprint,
        staleRows: (current, correction, runtimeComparison) =>
          current.chunks.map((chunk) => ({
            chunk: chunk.id,
            slot: chunk.slot,
            status: "stale",
            runtimeComparison,
            correction,
          })),
        verifyPlan: () => {
          ++verifyCalls;
          if (invalidPlan) throw new Error("current non-runtime input changed");
        },
      };

      const before = census(root);
      sourceFingerprint = "source-b";
      await module.reportProductionRenderStatus(runtime);
      TestValidator.equals(
        "source staleness wins before every runtime inspection",
        {
          inspectCalls,
          output: outputs.pop(),
          statusCalls,
          verifyCalls,
        },
        {
          inspectCalls: 0,
          output: [
            {
              chunk: "chunk-a",
              slot: "slot-a",
              status: "stale",
              runtimeComparison: "not-run",
              correction:
                "Source/design input changed. Run automovie render plan, then rerender only the new chunk identities.",
            },
          ],
          statusCalls: 0,
          verifyCalls: 0,
        },
      );

      sourceFingerprint = "source-a";
      const missingCorrection =
        "Dialogue/model or capture-runtime evidence is not ready. Run automovie render plan to materialize it.";
      inspection = {
        status: "not-ready",
        correction: missingCorrection,
        assertCurrent: () => Promise.resolve(),
        resources: inspectionResources(),
      };
      await module.reportProductionRenderStatus(runtime);
      let missingVerify: unknown;
      try {
        await module.verifyCurrentProductionRender(runtime);
      } catch (error) {
        missingVerify = error;
      }
      TestValidator.equals(
        "missing evidence is observed by status and refused exactly by verify",
        {
          output: outputs.pop(),
          statusCalls,
          verifyCalls,
          verifyFailure: message(missingVerify),
        },
        {
          output: [
            {
              chunk: "chunk-a",
              slot: "slot-a",
              status: "stale",
              runtimeComparison: "not-ready",
              correction: missingCorrection,
            },
          ],
          statusCalls: 0,
          verifyCalls: 0,
          verifyFailure: missingCorrection,
        },
      );

      const notRunCorrection =
        "Capture graphics identity comparison is not-run. Run npm run capture:doctor to re-establish it without repairing render state.";
      inspection = {
        status: "not-run",
        correction: notRunCorrection,
        assertCurrent: () => Promise.resolve(),
        resources: inspectionResources(),
      };
      await module.reportProductionRenderStatus(runtime);
      let notRunVerify: unknown;
      try {
        await module.verifyCurrentProductionRender(runtime);
      } catch (error) {
        notRunVerify = error;
      }
      TestValidator.equals(
        "unobserved graphics identity is explicit and never copied from the plan",
        {
          output: outputs.pop(),
          statusCalls,
          verifyCalls,
          verifyFailure: message(notRunVerify),
        },
        {
          output: [
            {
              chunk: "chunk-a",
              slot: "slot-a",
              status: "stale",
              runtimeComparison: "not-run",
              correction: notRunCorrection,
            },
          ],
          statusCalls: 0,
          verifyCalls: 0,
          verifyFailure: notRunCorrection,
        },
      );

      inspection = {
        ...currentInspection({
          ...inputs,
          runtimeIdentity: { generation: "runtime-b" },
        }),
      };
      const drift = await module.inspectCurrentProductionRender(runtime);
      inspection = currentInspection(inputs);
      invalidPlan = true;
      const invalid = await module.inspectCurrentProductionRender(runtime);
      invalidPlan = false;
      TestValidator.equals(
        "runtime drift and non-runtime plan drift keep exact separate corrections",
        {
          drift:
            drift.status === "stale" && drift.correction.startsWith("Capture"),
          invalid:
            invalid.status === "stale" &&
            invalid.correction.startsWith("Stored render plan"),
          statusCalls,
          verifyCalls,
          currentAssertions,
          resourceCleanups,
        },
        {
          drift: true,
          invalid: true,
          statusCalls: 0,
          verifyCalls: 1,
          currentAssertions: 3,
          resourceCleanups: 6,
        },
      );

      const snapshotRace = new Error(
        "read-only input generation changed before validation",
      );
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: inspectionResources(),
        assertCurrent: () => {
          throw snapshotRace;
        },
      });
      let snapshotRaceObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        snapshotRaceObserved = error;
      }
      TestValidator.equals(
        "input-generation races close their snapshot before any status read",
        {
          identity: snapshotRaceObserved === snapshotRace,
          resourceCleanups,
          statusCalls,
        },
        { identity: true, resourceCleanups: 7, statusCalls: 0 },
      );

      let validationAssertions = 0;
      const validationRace = new Error(
        "read-only input generation changed during plan validation",
      );
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: inspectionResources(),
        assertCurrent: (): Promise<void> => {
          if (++validationAssertions === 2) throw validationRace;
          return Promise.resolve();
        },
      });
      let validationRaceObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        validationRaceObserved = error;
      }
      TestValidator.equals(
        "input-generation races after validation close before chunk inspection",
        {
          identity: validationRaceObserved === validationRace,
          resourceCleanups,
          statusCalls,
        },
        { identity: true, resourceCleanups: 8, statusCalls: 0 },
      );
      runtime.inspectInputs = () => currentInspection(inputs);

      await module.reportProductionRenderStatus(runtime);
      await module.verifyCurrentProductionRender(runtime);
      const verified = outputs.pop();
      const currentRows = outputs.pop();
      TestValidator.equals(
        "complete current evidence reports and verifies without materialization",
        {
          currentRows,
          verified,
          fetchCalls,
          statusCalls,
          verifyCalls,
          currentAssertions,
          resourceCleanups,
        },
        {
          currentRows: [{ status: "complete" }],
          verified: {
            verified: true,
            plan,
            chunks: [{ status: "complete" }],
          },
          fetchCalls: 0,
          statusCalls: 2,
          verifyCalls: 4,
          currentAssertions: 11,
          resourceCleanups: 10,
        },
      );

      rows = [{ status: "planned" }];
      let incomplete: unknown;
      try {
        await module.verifyCurrentProductionRender(runtime);
      } catch (error) {
        incomplete = error;
      }
      TestValidator.equals(
        "verify refuses an incomplete current chunk with the exact recovery",
        message(incomplete),
        "Render verification found incomplete chunks. Run automovie render status, then run.",
      );

      rows = [{ status: "complete" }];
      replacePlanDuringStatus = true;
      const outputsBeforePlanRace = outputs.length;
      let planRaceObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        planRaceObserved = error;
      }
      replacePlanDuringStatus = false;
      TestValidator.equals(
        "a foreign plan successor invalidates the whole read before publication",
        {
          identity: planRaceObserved === foreignPlanSuccessor,
          outputCount: outputs.length,
        },
        { identity: true, outputCount: outputsBeforePlanRace },
      );

      const changed = new Error("read-only runtime generation changed");
      let raceAssertions = 0;
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: inspectionResources(),
        assertCurrent: (): Promise<void> => {
          if (++raceAssertions === 4) throw changed;
          return Promise.resolve();
        },
      });
      rows = [{ status: "complete" }];
      const outputsBeforeRace = outputs.length;
      let raceObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        raceObserved = error;
      }
      const primary = new Error("read-only chunk inspection failed");
      const cleanup = new Error("read-only descriptor cleanup failed");
      const descriptorCleanup = new Error(
        "read-only inspection resource cleanup failed",
      );
      statusState.failure = primary;
      raceAssertions = 0;
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: inspectionResources(),
        assertCurrent: (): Promise<void> => {
          if (++raceAssertions === 4) throw cleanup;
          return Promise.resolve();
        },
      });
      let combined: unknown;
      resourceFailure.error = descriptorCleanup;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        combined = error;
      }
      resourceFailure.error = null;
      raceAssertions = 0;
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: inspectionResources(),
        assertCurrent: (): Promise<void> => {
          ++raceAssertions;
          return Promise.resolve();
        },
      });
      let primaryOnly: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        primaryOnly = error;
      }
      statusState.failure = primary;
      resourceFailure.error = cleanup;
      raceAssertions = 0;
      let cleanupCombined: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        cleanupCombined = error;
      }
      resourceFailure.error = null;
      TestValidator.equals(
        "read and generation failures retain primary-first order without publication",
        {
          raceIdentity: raceObserved === changed,
          aggregate: combined instanceof AggregateError,
          cause:
            combined instanceof AggregateError ? combined.cause : undefined,
          errors:
            combined instanceof AggregateError
              ? [...combined.errors]
              : undefined,
          outputCount: outputs.length,
          primaryIdentity: primaryOnly === primary,
          cleanupAggregate: cleanupCombined instanceof AggregateError,
          cleanupCause:
            cleanupCombined instanceof AggregateError
              ? cleanupCombined.cause
              : undefined,
          cleanupErrors:
            cleanupCombined instanceof AggregateError
              ? [...cleanupCombined.errors]
              : undefined,
        },
        {
          raceIdentity: true,
          aggregate: true,
          cause: primary,
          errors: [primary, cleanup, descriptorCleanup],
          outputCount: outputsBeforeRace,
          primaryIdentity: true,
          cleanupAggregate: true,
          cleanupCause: primary,
          cleanupErrors: [primary, cleanup],
        },
      );
      statusState.failure = null;
      const singleCleanup = new Error("one read-only resource failed to close");
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: [
          {
            resource: "single resource",
            cleanup: () => {
              throw singleCleanup;
            },
          },
        ],
        assertCurrent: () => Promise.resolve(),
      });
      const outputBeforeSingleCleanup = outputs.length;
      let singleCleanupObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        singleCleanupObserved = error;
      }
      const firstCleanup = new Error(
        "first read-only resource failed to close",
      );
      const secondCleanup = new Error(
        "second read-only resource failed to close",
      );
      runtime.inspectInputs = () => ({
        status: "current",
        inputs,
        resources: [
          {
            resource: "first resource",
            cleanup: () => {
              throw firstCleanup;
            },
          },
          {
            resource: "second resource",
            cleanup: () => {
              throw secondCleanup;
            },
          },
        ],
        assertCurrent: () => Promise.resolve(),
      });
      let multipleCleanupsObserved: unknown;
      try {
        await module.reportProductionRenderStatus(runtime);
      } catch (error) {
        multipleCleanupsObserved = error;
      }
      TestValidator.equals(
        "cleanup-only failures stay exact and prevent current publication",
        {
          singleIdentity: singleCleanupObserved === singleCleanup,
          multipleAggregate: multipleCleanupsObserved instanceof AggregateError,
          multipleCause:
            multipleCleanupsObserved instanceof AggregateError
              ? multipleCleanupsObserved.cause
              : undefined,
          multipleErrors:
            multipleCleanupsObserved instanceof AggregateError
              ? [...multipleCleanupsObserved.errors]
              : undefined,
          outputCount: outputs.length,
        },
        {
          singleIdentity: true,
          multipleAggregate: true,
          multipleCause: firstCleanup,
          multipleErrors: [firstCleanup, secondCleanup],
          outputCount: outputBeforeSingleCleanup,
        },
      );
      TestValidator.equals(
        "the generated project remains byte-identical after every read",
        {
          before,
          after: census(root),
          rendered: rendered[relative],
          generated,
        },
        { before, after: before, rendered: source, generated: source },
      );
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      globalThis.fetch = originalFetch;
      preserveCliHarnessCleanup(failure, [
        {
          resource: "render read-only status fixture",
          cleanup: () =>
            fixture.preserve
              ? undefined
              : fs.rmSync(root, { force: true, recursive: true }),
        },
      ]);
    }
  };
