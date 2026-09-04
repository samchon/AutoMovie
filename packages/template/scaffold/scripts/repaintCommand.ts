import {
  AutoMovieProductionContext,
  AutoMovieProductionRepaintService,
} from "@automovie/production";

import {
  type IAutoMovieProductionRepaintSelection,
  assertProductionRepaintCandidateAdoption,
  readProductionRepaintCommand,
  selectProductionRepaintCandidateReview,
  selectProductionRepaintRequest,
} from "./productionConfiguration";
import type { repaintProductionShot } from "./repaintAdapter";

type RepaintOutput = Awaited<
  ReturnType<AutoMovieProductionRepaintService["serve"]>
>;

export interface IProductionRepaintInvocation {
  kind: "reroll" | "retry" | "selection" | "reversal";
  productionId: string;
  generator: IAutoMovieProductionRepaintSelection["generator"];
  executionPolicy: IAutoMovieProductionRepaintSelection["executionPolicy"];
  request: IAutoMovieProductionRepaintSelection["requests"][number];
  requestId?: string;
  attemptId?: string;
}

export interface IProductionRepaintHost {
  closeCapture: (failure: { error: unknown } | undefined) => Promise<void>;
  serve: (invocation: IProductionRepaintInvocation) => Promise<RepaintOutput>;
  setExitCode: (value: number) => void;
  stdout: (value: string) => void;
}

/** Execute one reviewed shot request and preserve cleanup failure semantics. */
export const runProductionRepaintCommand = async (
  args: readonly string[],
  authored: {
    /** The production namespace the reviewed request belongs to. */
    productionId: string;
    /**
     * This production's own reviewed repaint adoption, or null for none.
     *
     * Resident bytes rather than a compile-time literal, so the parser below
     * settles its shape before an operation reads a prompt out of it.
     */
    repaint: unknown;
  },
  createHost: () => IProductionRepaintHost,
  occurredAt: Date | string = new Date(),
): Promise<void> => {
  const command = readProductionRepaintCommand(args);
  const selected = selectProductionRepaintRequest(
    authored.repaint,
    command.shot,
    occurredAt,
  );
  const host = createHost();
  let failure: { error: unknown } | undefined;
  try {
    const output = await host.serve({
      kind: command.kind,
      generator: selected.generator,
      executionPolicy: selected.executionPolicy,
      productionId: authored.productionId,
      request: selected.request,
      ...(command.kind === "retry"
        ? { requestId: command.requestId }
        : command.kind === "selection" || command.kind === "reversal"
          ? { attemptId: command.attemptId }
          : {}),
    });
    host.stdout(`${JSON.stringify(output, null, 2)}\n`);
    if (output.repainted === false) host.setExitCode(1);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    await host.closeCapture(failure);
  }
};

/** Bind the generated adapter and actual production service to the command. */
export const createNodeProductionRepaintHost = (props: {
  adapter: typeof repaintProductionShot;
  capture: ConstructorParameters<typeof AutoMovieProductionContext>[0];
  closeCapture: IProductionRepaintHost["closeCapture"];
  root: string;
  signal?: AbortSignal;
  setExitCode: IProductionRepaintHost["setExitCode"];
  stdout: IProductionRepaintHost["stdout"];
}): IProductionRepaintHost => ({
  closeCapture: props.closeCapture,
  serve: async (invocation) => {
    const context = new AutoMovieProductionContext(
      props.capture,
      props.root,
      invocation.productionId,
    );
    if (invocation.kind === "selection" || invocation.kind === "reversal") {
      const inspection = context
        .forProduction(invocation.productionId)
        .project.inspectVerifiedRepaintCandidates([invocation.request.shot]);
      const candidate = inspection.records
        .map((record) => record.value)
        .find((receipt) => receipt.attemptId === invocation.attemptId);
      if (candidate === undefined && inspection.findings.length !== 0)
        return repaintSelectionRefusal(
          invocation,
          null,
          `Repaint candidate inspection refused: ${inspection.findings
            .map(
              (finding) =>
                `${finding.target.recordId}:${finding.stage}:${finding.failure}`,
            )
            .join(", ")}.`,
        );
      if (candidate === undefined)
        return repaintSelectionRefusal(
          invocation,
          null,
          `Repaint candidate "${invocation.attemptId}" is absent, invalid, or stale for shot "${invocation.request.shot}".`,
        );
      let review: ReturnType<typeof selectProductionRepaintCandidateReview>;
      try {
        assertProductionRepaintCandidateAdoption({
          selected: {
            generator: invocation.generator,
            executionPolicy: invocation.executionPolicy,
            requests: [invocation.request],
          },
          receipt: candidate,
        });
        review = selectProductionRepaintCandidateReview({
          request: invocation.request,
          receipt: candidate,
        });
      } catch (error) {
        return repaintSelectionRefusal(
          invocation,
          candidate.requestId ?? null,
          error instanceof Error ? error.message : String(error),
        );
      }
      return new AutoMovieProductionRepaintService().select(context, {
        productionId: invocation.productionId,
        shot: invocation.request.shot,
        attemptId: invocation.attemptId!,
        kind: invocation.kind,
        ...review,
      });
    }
    return new AutoMovieProductionRepaintService(
      props.adapter,
      invocation.generator,
      {
        policy: invocation.executionPolicy,
        evidence: invocation.request.evidence,
        ...(invocation.requestId === undefined
          ? {}
          : { requestId: invocation.requestId }),
        ...(props.signal === undefined ? {} : { signal: props.signal }),
      },
    ).serve(context, {
      parameters: invocation.request.parameters,
      productionId: invocation.productionId,
      references: [...invocation.request.references],
      shot: invocation.request.shot,
    });
  },
  setExitCode: props.setExitCode,
  stdout: props.stdout,
});

const repaintSelectionRefusal = (
  invocation: IProductionRepaintInvocation,
  requestId: string | null,
  message: string,
): RepaintOutput => ({
  repainted: false,
  selected: false,
  requestId,
  productionId: invocation.productionId,
  shot: invocation.request.shot,
  receipt: null,
  diagnostics: [
    {
      code: "repaint-commit-refused",
      category: "error",
      phase: "render",
      target: invocation.request.shot,
      path: null,
      message,
    },
  ],
});
