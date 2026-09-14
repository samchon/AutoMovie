import { createHumanFaceWorkerHandler } from "@automovie/playground/src/human/workerHandler";
import { TestValidator } from "@nestia/e2e";

/**
 * A worker exports the model built from its parsed document and transfers the
 * exact exported buffer, while awaiting export before sending any reply.
 *
 * Scenarios:
 * 1. Hand-written document and model tokens pin parse/build/export ordering.
 * 2. A held export produces no reply; completion publishes its bytes and count.
 * 3. Empty parts are counted without manufacturing geometry.
 */
export const test_subject_human_worker_success = async (): Promise<void> => {
  for (const parts of [[], [1, 2]]) {
    const document = { id: "face" };
    const model = { parts };
    const glb = new Uint8Array([1, 2, 3]);
    const gltf = { json: { asset: { version: "2.0" } }, resources: {} };
    let complete!: (artifact: { glb: typeof glb; gltf: typeof gltf }) => void;
    const exported = new Promise<{ glb: typeof glb; gltf: typeof gltf }>(
      (resolve) => {
        complete = resolve;
      },
    );
    const calls: string[] = [];
    const replies: unknown[] = [];
    const transfers: (ArrayBuffer[] | undefined)[] = [];
    const handle = createHumanFaceWorkerHandler({
      parse: (text) => {
        TestValidator.equals("parse input", text, "serialized");
        calls.push("parse");
        return document;
      },
      build: (input) => {
        TestValidator.predicate("parsed identity", input === document);
        calls.push("build");
        return model;
      },
      export: (input) => {
        TestValidator.predicate("built identity", input === model);
        calls.push("export");
        return exported;
      },
      send: (reply, transfer) => {
        replies.push(reply);
        transfers.push(transfer);
      },
    });
    const pending = handle("serialized");
    TestValidator.equals(
      "ordered synchronous admission and construction",
      calls,
      ["parse", "build", "export"],
    );
    TestValidator.equals("no partial reply", replies, []);
    complete({ glb, gltf });
    await pending;
    TestValidator.equals("one complete result", replies, [
      { success: true, document, glb, gltf, parts: parts.length },
    ]);
    TestValidator.predicate(
      "exact export buffer transferred",
      transfers.length === 1 &&
        transfers[0]?.length === 1 &&
        transfers[0][0] === glb.buffer,
    );
  }
};
