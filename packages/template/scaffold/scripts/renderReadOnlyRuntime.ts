interface IStoredRenderPlan {
  compileFingerprint: string;
  runtimeIdentity: unknown;
}

interface IRenderStatusRow {
  status: string;
}

/** One descriptor or temporary inspection resource that must always close. */
export interface IProductionRenderReadOnlyResource {
  cleanup: () => unknown;
  resource: string;
}

/** A descriptor-bound inspection either reconstructs current inputs or names repair. */
export type ProductionRenderReadOnlyInputInspection<Inputs> =
  | {
      status: "current";
      inputs: Inputs;
      assertCurrent: () => unknown;
      resources: readonly IProductionRenderReadOnlyResource[];
    }
  | {
      status: "not-ready" | "not-run" | "stale";
      correction: string;
      assertCurrent: () => unknown;
      resources: readonly IProductionRenderReadOnlyResource[];
    };

/** Read-only seams shared by `render status` and `render verify`. */
export interface IProductionRenderReadOnlyRuntime<
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
> {
  inspectInputs: (
    plan: Plan,
  ) =>
    | ProductionRenderReadOnlyInputInspection<Inputs>
    | Promise<ProductionRenderReadOnlyInputInspection<Inputs>>;
  assertPlanCurrent: (plan: Plan) => unknown;
  output: (value: unknown) => void;
  readPlan: () => Plan;
  renderStatus: (
    plan: Plan,
  ) => IRenderStatusRow[] | Promise<IRenderStatusRow[]>;
  reportStatus?: (
    plan: Plan,
  ) => IRenderStatusRow[] | Promise<IRenderStatusRow[]>;
  runtimeIdentitiesEqual: (left: unknown, right: unknown) => boolean;
  sourceFingerprint: () => string;
  staleRows: (
    plan: Plan,
    reason: string,
    runtimeComparison: "not-ready" | "not-run" | "stale",
  ) => unknown;
  verifyPlan: (props: { plan: Plan } & Inputs) => void;
}

/** Current plan evidence or the exact materializing correction it still needs. */
export type ProductionRenderReadOnlyPlanInspection<Plan, Inputs> =
  | {
      status: "current";
      plan: Plan;
      inputs: Inputs;
      assertCurrent: () => unknown;
      resources: readonly IProductionRenderReadOnlyResource[];
    }
  | {
      status: "stale";
      plan: Plan;
      correction: string;
      runtimeComparison: "not-ready" | "not-run" | "stale";
      assertCurrent: () => unknown;
      resources: readonly IProductionRenderReadOnlyResource[];
    };

class ProductionRenderReadOnlyFailure extends AggregateError {}

const failureSequence = (error: unknown): unknown[] =>
  error instanceof AggregateError ? [...error.errors] : [error];

/** Finish every inspection cleanup while retaining the operation as cause. */
const settleProductionRenderReadOnly = async <Output>(
  operation: () => Output | Promise<Output>,
  resources: readonly IProductionRenderReadOnlyResource[],
): Promise<Output> => {
  let output: { value: Output } | undefined;
  let failure: { error: unknown } | undefined;
  try {
    output = { value: await operation() };
  } catch (error) {
    failure = { error };
  }
  const settled = await Promise.allSettled(
    resources.map((resource) => Promise.resolve().then(resource.cleanup)),
  );
  const cleanupFailures = settled.flatMap((result, index) =>
    result.status === "fulfilled"
      ? []
      : [
          {
            error: result.reason,
            resource: resources[index]!.resource,
          },
        ],
  );
  if (cleanupFailures.length === 0) {
    if (failure !== undefined) throw failure.error;
    return output!.value;
  }
  if (failure === undefined && cleanupFailures.length === 1)
    throw cleanupFailures[0]!.error;
  const errors = [
    ...(failure === undefined ? [] : failureSequence(failure.error)),
    ...cleanupFailures.map((entry) => entry.error),
  ];
  throw new ProductionRenderReadOnlyFailure(
    errors,
    `Render read-only cleanup failed: ${cleanupFailures
      .map((entry) => entry.resource)
      .join(", ")}.`,
    { cause: errors[0] },
  );
};

/** Inspect one stored plan without preparing sound, capture, or publication state. */
export const inspectCurrentProductionRender = async <
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
>(
  runtime: IProductionRenderReadOnlyRuntime<Plan, Inputs>,
): Promise<ProductionRenderReadOnlyPlanInspection<Plan, Inputs>> => {
  const plan = runtime.readPlan();
  const assertPlanCurrent = (): unknown => runtime.assertPlanCurrent(plan);
  await assertPlanCurrent();
  const sourceFingerprint = runtime.sourceFingerprint();
  await assertPlanCurrent();
  if (sourceFingerprint !== plan.compileFingerprint)
    return {
      status: "stale",
      plan,
      assertCurrent: assertPlanCurrent,
      resources: [],
      runtimeComparison: "not-run",
      correction:
        "Source/design input changed. Run automovie render plan, then rerender only the new chunk identities.",
    };
  await assertPlanCurrent();
  const inspected = await runtime.inspectInputs(plan);
  const assertCurrent = async (): Promise<void> => {
    await assertPlanCurrent();
    await inspected.assertCurrent();
  };
  try {
    await assertCurrent();
  } catch (error) {
    return settleProductionRenderReadOnly(() => {
      throw error;
    }, inspected.resources);
  }
  if (inspected.status !== "current")
    return {
      status: "stale",
      plan,
      correction: inspected.correction,
      runtimeComparison: inspected.status,
      assertCurrent,
      resources: inspected.resources,
    };
  try {
    if (
      runtime.runtimeIdentitiesEqual(
        inspected.inputs.runtimeIdentity,
        plan.runtimeIdentity,
      ) === false
    )
      return settleProductionRenderReadOnly(
        () => ({
          status: "stale" as const,
          plan,
          assertCurrent: assertPlanCurrent,
          resources: [],
          runtimeComparison: "stale" as const,
          correction:
            "Capture, graphics, render-source, or encoder identity changed. Run automovie render plan, then rerender only the new chunk identities.",
        }),
        inspected.resources,
      );
    let invalid = false;
    try {
      runtime.verifyPlan({ plan, ...inspected.inputs });
    } catch {
      invalid = true;
    }
    await assertCurrent();
    if (invalid)
      return settleProductionRenderReadOnly(
        () => ({
          status: "stale" as const,
          plan,
          assertCurrent: assertPlanCurrent,
          resources: [],
          runtimeComparison: "stale" as const,
          correction:
            "Stored render plan differs from current compiler-owned inputs. Run automovie render plan, then rerender only the new chunk identities.",
        }),
        inspected.resources,
      );
  } catch (error) {
    return settleProductionRenderReadOnly(() => {
      throw error;
    }, inspected.resources);
  }
  return {
    status: "current",
    plan,
    inputs: inspected.inputs,
    assertCurrent,
    resources: inspected.resources,
  };
};

/** Finish a read and its generation assertion without hiding either failure. */
const readWhileCurrent = async <Output>(
  read: () => Output | Promise<Output>,
  assertCurrent: () => unknown,
): Promise<Output> => {
  await assertCurrent();
  let result: { value: Output } | undefined;
  let failure: { error: unknown } | undefined;
  try {
    result = { value: await read() };
  } catch (error) {
    failure = { error };
  }
  let assertionFailure: { error: unknown } | undefined;
  try {
    await assertCurrent();
  } catch (error) {
    assertionFailure = { error };
  }
  if (failure !== undefined) {
    if (assertionFailure !== undefined)
      throw new AggregateError(
        [failure.error, assertionFailure.error],
        "Render read-only inspection and generation revalidation failed.",
        { cause: failure.error },
      );
    throw failure.error;
  }
  if (assertionFailure !== undefined) throw assertionFailure.error;
  return result!.value;
};

/** Report current or stale rows without repairing an unavailable dependency. */
export const reportProductionRenderStatus = async <
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
>(
  runtime: IProductionRenderReadOnlyRuntime<Plan, Inputs>,
): Promise<void> => {
  const inspected = await inspectCurrentProductionRender(runtime);
  if (inspected.status === "stale") {
    const rows = await settleProductionRenderReadOnly(
      () =>
        readWhileCurrent(
          () =>
            runtime.staleRows(
              inspected.plan,
              inspected.correction,
              inspected.runtimeComparison,
            ),
          inspected.assertCurrent,
        ),
      inspected.resources,
    );
    runtime.output(rows);
    return;
  }
  const rows = await settleProductionRenderReadOnly(
    () =>
      readWhileCurrent(
        () => (runtime.reportStatus ?? runtime.renderStatus)(inspected.plan),
        inspected.assertCurrent,
      ),
    inspected.resources,
  );
  runtime.output(rows);
};

/** Verify complete current chunks without repairing an unavailable dependency. */
export async function verifyCurrentProductionRender<
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
>(runtime: IProductionRenderReadOnlyRuntime<Plan, Inputs>): Promise<void> {
  const inspected = await inspectCurrentProductionRender(runtime);
  if (inspected.status === "stale")
    return settleProductionRenderReadOnly(
      () =>
        readWhileCurrent(() => {
          throw new Error(inspected.correction);
        }, inspected.assertCurrent),
      inspected.resources,
    );
  const output = await settleProductionRenderReadOnly(async () => {
    const chunks = await readWhileCurrent(
      () => runtime.renderStatus(inspected.plan),
      inspected.assertCurrent,
    );
    if (chunks.some((item) => item.status !== "complete"))
      throw new Error(
        "Render verification found incomplete chunks. Run automovie render status, then run.",
      );
    return { verified: true, plan: inspected.plan, chunks };
  }, inspected.resources);
  runtime.output(output);
}
