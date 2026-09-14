import type { createHumanPreviewBuilder } from "./previewBuilder";

type Port = ReturnType<
  Parameters<typeof createHumanPreviewBuilder>[0]["worker"]
>;

/**
 * Adapt browser worker events to the preview builder's numerical message port.
 * Each builder request owns its worker; the adapter retains no shared callbacks.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor-state Keeps completion and failure callbacks bound to one disposable worker.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor Bridges serialized requests and worker replies without publishing the resulting preview itself.
 */
export function createHumanPreviewWorkerPort(
  worker: Pick<Worker, "onerror" | "onmessage" | "postMessage" | "terminate">,
): Port {
  return {
    set onError(callback: Port["onError"]) {
      worker.onerror = (event) => callback(event.message);
    },
    set onReply(callback: Port["onReply"]) {
      worker.onmessage = (event) => callback(event.data);
    },
    send: (text) => worker.postMessage({ document: text }),
    terminate: () => worker.terminate(),
  };
}
