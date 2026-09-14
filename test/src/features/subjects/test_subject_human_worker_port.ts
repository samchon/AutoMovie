import { createHumanPreviewWorkerPort } from "@automovie/playground/src/human/workerPort";
import { TestValidator } from "@nestia/e2e";

/**
 * Worker events belong to their request's port and retain the exact success or
 * refusal payload; transport never interprets the numerical document itself.
 *
 * Scenarios:
 * 1. Requests are wrapped once, replies and error messages retain their values.
 * 2. Replacing callbacks switches delivery, while a second port stays isolated.
 * 3. Termination reaches only the selected worker.
 */
export const test_subject_human_worker_port = (): void => {
  const make = () => {
    const sent: unknown[] = [];
    const state = { terminations: 0 };
    const native = {
      onerror: null as ((event: ErrorEvent) => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
      postMessage: (message: unknown) => {
        sent.push(message);
      },
      terminate: () => {
        state.terminations++;
      },
    };
    return { native, sent, state, port: createHumanPreviewWorkerPort(native) };
  };
  const a = make(),
    b = make();
  const errors: string[] = [];
  const replies: unknown[] = [];
  a.port.onError = (message) => {
    errors.push(message);
  };
  a.port.onReply = (reply) => {
    replies.push(reply);
  };
  b.port.onError = (message) => {
    errors.push(`second:${message}`);
  };
  b.port.onReply = (reply) => {
    replies.push({ second: reply });
  };
  a.port.send("numeric document");
  TestValidator.equals("request envelope", a.sent, [
    { document: "numeric document" },
  ]);
  TestValidator.equals("other worker unchanged", b.sent, []);
  const success = {
    success: true,
    glb: new Uint8Array([1]),
    gltf: { json: { asset: { version: "2.0" } }, resources: {} },
    parts: 1,
  };
  a.native.onmessage!(new MessageEvent("message", { data: success }));
  TestValidator.predicate("success identity retained", replies[0] === success);
  a.native.onerror!({ message: "decode failed" } as ErrorEvent);
  a.port.onError = (message) => {
    errors.push(`replacement:${message}`);
  };
  a.native.onerror!({ message: "" } as ErrorEvent);
  b.native.onerror!({ message: "worker failed" } as ErrorEvent);
  b.native.onmessage!(
    new MessageEvent("message", { data: { success: false, error: "refused" } }),
  );
  TestValidator.equals("error ownership", errors, [
    "decode failed",
    "replacement:",
    "second:worker failed",
  ]);
  TestValidator.equals("refusal ownership", replies[1], {
    second: { success: false, error: "refused" },
  });
  a.port.terminate();
  TestValidator.equals(
    "only selected worker terminated",
    [a.state.terminations, b.state.terminations],
    [1, 0],
  );
};
