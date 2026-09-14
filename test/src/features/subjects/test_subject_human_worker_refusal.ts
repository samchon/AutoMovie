import { createHumanFaceWorkerHandler } from "@automovie/playground/src/human/workerHandler";
import { TestValidator } from "@nestia/e2e";

/**
 * Failure at any construction stage becomes one textual refusal and cannot
 * continue to a later stage or transfer a partially constructed artifact.
 *
 * Scenarios:
 * 1. Parse and build throw Errors; export rejects a non-Error value.
 * 2. Each refusal has no transfer list and stops exactly at its failing stage.
 * 3. A failed success transport is reported through the same error boundary.
 */
export const test_subject_human_worker_refusal = async (): Promise<void> => {
  for (const stage of ["parse", "build", "export", "send"]) {
    const calls: string[] = [];
    const replies: unknown[] = [];
    const transfers: (ArrayBuffer[] | undefined)[] = [];
    let failExport!: (reason: unknown) => void;
    const exportFailure = new Promise<never>((_resolve, reject) => {
      failExport = reject;
    });
    const visit = (current: string) => {
      calls.push(current);
      if (current === stage) throw new Error(`${stage} refused`);
    };
    const handle = createHumanFaceWorkerHandler({
      parse: () => {
        visit("parse");
        return {};
      },
      build: () => {
        visit("build");
        return { parts: [] };
      },
      export: async () => {
        calls.push("export");
        if (stage === "export") return exportFailure;
        return {
          glb: new Uint8Array([1]),
          gltf: { json: { asset: { version: "2.0" } }, resources: {} },
        };
      },
      send: (reply, transfer) => {
        if (reply.success) visit("send");
        replies.push(reply);
        transfers.push(transfer);
      },
    });
    const pending = handle("serialized");
    if (stage === "export") failExport("export refused");
    await pending;
    TestValidator.equals("one refusal", replies, [
      { success: false, error: `${stage} refused` },
    ]);
    TestValidator.equals("no artifact transferred", transfers, [undefined]);
    const order = ["parse", "build", "export", "send"];
    TestValidator.equals(
      "failure stops the pipeline",
      calls,
      order.slice(0, order.indexOf(stage) + 1),
    );
  }
};
