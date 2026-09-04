import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

interface IPlan {
  compileFingerprint: string;
  runtimeIdentity: { generation: string };
}

const unit = loadSourceModule<{
  reportProductionRenderStatus: (runtime: {
    inspectInputs: (plan: IPlan) => {
      status: "current";
      inputs: { runtimeIdentity: IPlan["runtimeIdentity"] };
      assertCurrent: () => void;
      resources: [];
    };
    assertPlanCurrent: (plan: IPlan) => void;
    output: (value: unknown) => void;
    readPlan: () => IPlan;
    renderStatus: (plan: IPlan) => Array<{ status: string }>;
    reportStatus: (plan: IPlan) => Array<{ status: string }>;
    runtimeIdentitiesEqual: (left: unknown, right: unknown) => boolean;
    sourceFingerprint: () => string;
    staleRows: () => never;
    verifyPlan: () => void;
  }) => Promise<void>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderReadOnlyRuntime.ts",
  ),
);

/** Status may append plan-bound publication state without changing verify rows. */
export const test_cli_scaffold_render_publication_status =
  async (): Promise<void> => {
    const plan: IPlan = {
      compileFingerprint: "compile",
      runtimeIdentity: { generation: "runtime" },
    };
    const output: unknown[] = [];
    let chunkReads = 0;
    let publicationReads = 0;
    await unit.reportProductionRenderStatus({
      inspectInputs: () => ({
        status: "current",
        inputs: { runtimeIdentity: plan.runtimeIdentity },
        assertCurrent: () => undefined,
        resources: [],
      }),
      assertPlanCurrent: () => undefined,
      output: (value) => output.push(value),
      readPlan: () => plan,
      renderStatus: () => {
        ++chunkReads;
        return [{ status: "complete" }];
      },
      reportStatus: () => {
        ++publicationReads;
        return [{ status: "publication-current" }];
      },
      runtimeIdentitiesEqual: (left, right) =>
        JSON.stringify(left) === JSON.stringify(right),
      sourceFingerprint: () => plan.compileFingerprint,
      staleRows: () => {
        throw new Error("current inputs cannot use stale rows");
      },
      verifyPlan: () => undefined,
    });
    TestValidator.equals(
      "status selects the publication-aware projection",
      { output, chunkReads, publicationReads },
      {
        output: [[{ status: "publication-current" }]],
        chunkReads: 0,
        publicationReads: 1,
      },
    );
  };
