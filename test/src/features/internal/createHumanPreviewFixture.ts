import { createHumanPreviewBuilder } from "@automovie/playground/src/human/previewBuilder";

type Options = Parameters<typeof createHumanPreviewBuilder<string>>[0];
type Worker = ReturnType<Options["worker"]>;

/** In-memory worker ports expose real request ordering without allocating a browser worker. */
export function createHumanPreviewFixture(
  options: Partial<Pick<Options, "decode">> & {
    sendError?: Error;
    workerError?: Error;
  } = {},
) {
  const workers: (Worker & { sent: string[]; terminations: number })[] = [];
  const decoded: Parameters<Options["decode"]>[0][] = [];
  const disposed: string[] = [];
  const builder = createHumanPreviewBuilder({
    worker: () => {
      if (options.workerError) throw options.workerError;
      const worker = {
        onError: (_message: string): void => {},
        onReply: (_reply: Parameters<Worker["onReply"]>[0]): void => {},
        sent: [] as string[],
        terminations: 0,
        send: (text: string): void => {
          if (options.sendError) throw options.sendError;
          worker.sent.push(text);
        },
        terminate: (): void => {
          worker.terminations++;
        },
      };
      workers.push(worker);
      return worker;
    },
    decode: async (artifact) => {
      decoded.push(artifact);
      return options.decode
        ? options.decode(artifact)
        : `preview-${artifact.parts}`;
    },
    dispose: (model) => {
      disposed.push(model);
    },
  });
  const reply = (parts: number): Parameters<Worker["onReply"]>[0] => ({
    success: true,
    glb: new Uint8Array([1]),
    gltf: { json: { asset: { version: "2.0" } }, resources: {} },
    parts,
  });
  return { builder, workers, decoded, disposed, reply };
}
