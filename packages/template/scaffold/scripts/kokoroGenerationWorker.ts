import type { AutoMovieContentDigest } from "@automovie/interface";
import { pathToFileURL } from "node:url";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

import {
  type IRuntimePackageSnapshot,
  type RuntimePackageAssetSelection,
  assertRuntimePackageSnapshotCurrent,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

export interface IKokoroGenerationWorkerPackage {
  assets?: readonly RuntimePackageAssetSelection[];
  contentFingerprint: AutoMovieContentDigest;
  entry: string;
  fingerprint: AutoMovieContentDigest;
  moduleClosure?: boolean;
  packageExports?: boolean;
  packageName: string;
}

export interface IKokoroGenerationWorkerSelection {
  device: "cpu";
  dtype: "q8";
  model: string;
  modelRevision: string;
}

export interface IKokoroGenerationChunk {
  audio: Float32Array;
  phonemes: string;
  sampleRate: number;
}

export interface IKokoroGenerationWorker {
  close: () => Promise<void>;
  synthesize: (props: {
    speed: number;
    text: string;
    voice: string;
  }) => Promise<IKokoroGenerationChunk[]>;
}

interface IKokoroWorkerData {
  cacheRoot: string;
  packages: readonly IKokoroGenerationWorkerPackage[];
  protocol: "automovie.kokoro-generation-worker.v1";
  selection: IKokoroGenerationWorkerSelection;
}

type KokoroWorkerRequest =
  | {
      id: number;
      kind: "synthesize";
      speed: number;
      text: string;
      voice: string;
    }
  | { id: number; kind: "close" };

type KokoroWorkerResponse =
  | { id: 0; kind: "ready" }
  | { id: number; kind: "closed" }
  | { chunks: IKokoroGenerationChunk[]; id: number; kind: "synthesized" }
  | { id: number; kind: "failed"; message: string };

interface IKokoroTextSplitter extends AsyncIterable<string> {
  close(): void;
  push(text: string): void;
}

interface IKokoroRuntime {
  stream(
    splitter: IKokoroTextSplitter,
    options: { speed: number; voice: string },
  ): AsyncIterable<{
    audio: { audio: Float32Array | number[]; sampling_rate: number };
    phonemes: string;
  }>;
}

interface IKokoroModule {
  KokoroTTS: {
    from_pretrained(
      model: string,
      options: { device: "cpu"; dtype: "q8" },
    ): Promise<IKokoroRuntime>;
  };
  TextSplitterStream: new () => IKokoroTextSplitter;
}

interface ITransformersModule {
  env: { cacheDir?: string };
}

/**
 * Start one fresh ESM registry whose package snapshots precede every import.
 * The worker is the cache-generation owner because no target package is loaded
 * by its bootstrap, and it is discarded instead of adopting another registry.
 */
export const createKokoroGenerationWorker = async (props: {
  cacheRoot: string;
  packages: readonly IKokoroGenerationWorkerPackage[];
  selection: IKokoroGenerationWorkerSelection;
}): Promise<IKokoroGenerationWorker> => {
  const data: IKokoroWorkerData = {
    cacheRoot: props.cacheRoot,
    packages: props.packages,
    protocol: "automovie.kokoro-generation-worker.v1",
    selection: props.selection,
  };
  const worker = new Worker(new URL(import.meta.url), { workerData: data });
  let nextId = 1;
  let terminal: Error | undefined;
  const pending = new Map<
    number,
    {
      reject: (error: Error) => void;
      resolve: (response: KokoroWorkerResponse) => void;
    }
  >();
  const failPending = (error: Error): void => {
    terminal ??= error;
    for (const request of pending.values()) request.reject(terminal);
    pending.clear();
  };
  worker.on("error", (error) => failPending(error));
  worker.on("exit", (code) => {
    failPending(
      new Error(`Kokoro generation worker exited with code ${code}.`),
    );
  });
  worker.on("message", (response: KokoroWorkerResponse) => {
    if (response.kind === "ready") {
      pending.get(0)?.resolve(response);
      pending.delete(0);
      return;
    }
    const request = pending.get(response.id);
    if (request === undefined) return;
    pending.delete(response.id);
    if (response.kind === "failed") request.reject(new Error(response.message));
    else request.resolve(response);
  });
  const request = (
    message: KokoroWorkerRequest,
  ): Promise<KokoroWorkerResponse> => {
    if (terminal !== undefined) return Promise.reject(terminal);
    return new Promise((resolve, reject) => {
      pending.set(message.id, { reject, resolve });
      try {
        worker.postMessage(message);
      } catch (error) {
        pending.delete(message.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  try {
    await new Promise<KokoroWorkerResponse>((resolve, reject) => {
      pending.set(0, { reject, resolve });
    });
  } catch (error) {
    await worker.terminate();
    throw error;
  }
  return {
    synthesize: async (input) => {
      const response = await request({
        id: nextId++,
        kind: "synthesize",
        ...input,
      });
      if (response.kind !== "synthesized")
        throw new Error("Kokoro generation worker returned no synthesis.");
      return response.chunks;
    },
    close: async () => {
      if (terminal !== undefined) return;
      const response = await request({ id: nextId++, kind: "close" });
      if (response.kind !== "closed")
        throw new Error("Kokoro generation worker did not close cleanly.");
      await worker.terminate();
    },
  };
};

const serveKokoroGenerationWorker = async (
  data: IKokoroWorkerData,
): Promise<void> => {
  if (
    parentPort === null ||
    data.protocol !== "automovie.kokoro-generation-worker.v1"
  )
    throw new Error("Kokoro generation worker bootstrap is invalid.");
  const snapshots = data.packages.map((declared) => {
    const snapshot = snapshotRuntimePackage({
      assets: declared.assets,
      entry: declared.entry,
      moduleClosure: declared.moduleClosure,
      packageExports: declared.packageExports,
      packageName: declared.packageName,
    });
    if (
      snapshot.fingerprint !== declared.fingerprint ||
      snapshot.contentFingerprint !== declared.contentFingerprint
    )
      throw new Error(
        `Runtime package "${declared.packageName}" changed before its isolated worker loaded.`,
      );
    return snapshot;
  });
  const assertCurrent = (): void => {
    for (const snapshot of snapshots)
      assertRuntimePackageSnapshotCurrent(snapshot);
  };
  const required = (packageName: string): IRuntimePackageSnapshot => {
    const index = data.packages.findIndex(
      (entry) => entry.packageName === packageName,
    );
    const snapshot = snapshots[index];
    if (snapshot === undefined)
      throw new Error(
        `Kokoro generation worker lacks runtime package "${packageName}".`,
      );
    return snapshot;
  };
  assertCurrent();
  const [kokoro, transformers] = await Promise.all([
    import(
      pathToFileURL(required("kokoro-js").entry).href
    ) as Promise<IKokoroModule>,
    import(
      pathToFileURL(required("@huggingface/transformers").entry).href
    ) as Promise<ITransformersModule>,
  ]);
  assertCurrent();
  transformers.env.cacheDir = data.cacheRoot;
  const hostFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const source =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const marker = `huggingface.co/${data.selection.model}/resolve/`;
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) return hostFetch(input, init);
    const suffix = source.slice(markerIndex + marker.length);
    const separator = suffix.indexOf("/");
    if (separator < 0) throw new Error("Kokoro model URL has no asset path.");
    const pinned =
      source.slice(0, markerIndex + marker.length) +
      data.selection.modelRevision +
      suffix.slice(separator);
    const request =
      typeof input === "object" &&
      input !== null &&
      "url" in input &&
      input instanceof Request
        ? new Request(pinned, input)
        : pinned;
    return hostFetch(request, init);
  };
  const runtime = await kokoro.KokoroTTS.from_pretrained(data.selection.model, {
    dtype: data.selection.dtype,
    device: data.selection.device,
  });
  assertCurrent();
  parentPort.postMessage({
    id: 0,
    kind: "ready",
  } satisfies KokoroWorkerResponse);

  const respond = async (request: KokoroWorkerRequest): Promise<void> => {
    try {
      if (request.kind === "close") {
        assertCurrent();
        parentPort.postMessage({
          id: request.id,
          kind: "closed",
        } satisfies KokoroWorkerResponse);
        return;
      }
      assertCurrent();
      const splitter = new kokoro.TextSplitterStream();
      splitter.push(request.text);
      splitter.close();
      const chunks: IKokoroGenerationChunk[] = [];
      for await (const chunk of runtime.stream(splitter, {
        speed: request.speed,
        voice: request.voice,
      }))
        chunks.push({
          audio: Float32Array.from(chunk.audio.audio),
          phonemes: chunk.phonemes,
          sampleRate: chunk.audio.sampling_rate,
        });
      assertCurrent();
      parentPort.postMessage({
        chunks,
        id: request.id,
        kind: "synthesized",
      } satisfies KokoroWorkerResponse);
    } catch (error) {
      parentPort.postMessage({
        id: request.id,
        kind: "failed",
        message: error instanceof Error ? error.message : String(error),
      } satisfies KokoroWorkerResponse);
    }
  };
  let requests = Promise.resolve();
  parentPort.on("message", (request: KokoroWorkerRequest) => {
    requests = requests.then(
      () => respond(request),
      () => respond(request),
    );
  });
};

if (isMainThread === false)
  void serveKokoroGenerationWorker(workerData as IKokoroWorkerData).catch(
    (error: unknown) => {
      parentPort?.postMessage({
        id: 0,
        kind: "failed",
        message: error instanceof Error ? error.message : String(error),
      } satisfies KokoroWorkerResponse);
    },
  );
