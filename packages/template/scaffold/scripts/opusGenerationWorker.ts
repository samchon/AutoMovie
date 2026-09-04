import type { AutoMovieContentDigest } from "@automovie/interface";
import { pathToFileURL } from "node:url";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

import {
  type RuntimePackageAssetSelection,
  assertRuntimePackageSnapshotCurrent,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

export interface IOpusGenerationWorkerPackage {
  assets?: readonly RuntimePackageAssetSelection[];
  contentFingerprint: AutoMovieContentDigest;
  entry: string;
  fingerprint: AutoMovieContentDigest;
  packageExports?: boolean;
  packageName: string;
}

export interface IOpusGenerationPacket {
  bytes: Uint8Array;
  dts: number;
  duration: number;
}

export interface IOpusGenerationResult {
  codedSampleFrames: number;
  packets: IOpusGenerationPacket[];
  primingSamples: number;
}

interface IOpusGenerationWorkerData {
  package: IOpusGenerationWorkerPackage;
  pcm: Float32Array;
  protocol: "automovie.opus-generation-worker.v1";
}

type OpusGenerationWorkerResponse =
  | { kind: "encoded"; result: IOpusGenerationResult }
  | { kind: "failed"; message: string };

interface IOpusEncoder {
  channels: number;
  encodeFloat(frame: Float32Array): Uint8Array;
  frameSize: number;
  free(): void;
  getLookahead(): number;
  sampleRate: number;
}

interface IOpusModule {
  createEncoder(options: {
    bitrate: number;
    complexity: number;
    vbr: boolean;
  }): Promise<IOpusEncoder>;
}

class OpusGenerationOperationError extends AggregateError {}

/** Encode through a fresh ESM registry whose snapshot precedes its import. */
export const encodeOpusGeneration = async (props: {
  package: IOpusGenerationWorkerPackage;
  pcm: Float32Array;
}): Promise<IOpusGenerationResult> => {
  if (props.pcm.length === 0 || props.pcm.length % 2 !== 0)
    throw new Error("Opus encoding requires non-empty interleaved stereo PCM.");
  const worker = new Worker(new URL(import.meta.url), {
    workerData: {
      package: props.package,
      pcm: props.pcm,
      protocol: "automovie.opus-generation-worker.v1",
    } satisfies IOpusGenerationWorkerData,
  });
  let operationFailure: { error: unknown } | undefined;
  let result: IOpusGenerationResult | undefined;
  try {
    result = await new Promise<IOpusGenerationResult>((resolve, reject) => {
      let responded = false;
      worker.once("message", (response: OpusGenerationWorkerResponse) => {
        responded = true;
        if (response.kind === "failed") reject(new Error(response.message));
        else resolve(response.result);
      });
      worker.once("error", (error) => {
        responded = true;
        reject(error);
      });
      worker.once("exit", (code) => {
        if (responded === false)
          reject(new Error(`Opus generation worker exited with code ${code}.`));
      });
    });
  } catch (error) {
    operationFailure = { error };
  }
  try {
    await worker.terminate();
  } catch (cleanupError) {
    if (operationFailure === undefined) throw cleanupError;
    throw new OpusGenerationOperationError(
      [operationFailure.error, cleanupError],
      "Opus generation worker cleanup failed after encoding failed.",
    );
  }
  if (operationFailure !== undefined) throw operationFailure.error;
  return result!;
};

const serveOpusGenerationWorker = async (
  data: IOpusGenerationWorkerData,
): Promise<IOpusGenerationResult> => {
  if (
    parentPort === null ||
    data.protocol !== "automovie.opus-generation-worker.v1"
  )
    throw new Error("Opus generation worker bootstrap is invalid.");
  const snapshot = snapshotRuntimePackage({
    assets: data.package.assets,
    entry: data.package.entry,
    moduleClosure: true,
    packageExports: data.package.packageExports,
    packageName: data.package.packageName,
  });
  if (
    snapshot.fingerprint !== data.package.fingerprint ||
    snapshot.contentFingerprint !== data.package.contentFingerprint
  )
    throw new Error(
      `Runtime package "${data.package.packageName}" changed before its isolated worker loaded.`,
    );
  assertRuntimePackageSnapshotCurrent(snapshot);
  const runtime = (await import(
    pathToFileURL(snapshot.entry).href
  )) as IOpusModule;
  assertRuntimePackageSnapshotCurrent(snapshot);
  const encoder = await runtime.createEncoder({
    bitrate: 128_000,
    complexity: 10,
    vbr: false,
  });
  let operationFailure: { error: unknown } | undefined;
  let result: IOpusGenerationResult | undefined;
  try {
    if (
      encoder.frameSize !== 960 ||
      encoder.channels !== 2 ||
      encoder.sampleRate !== 48_000
    )
      throw new Error(
        "Pinned Opus runtime no longer exposes the required 48 kHz stereo 20 ms profile.",
      );
    const primingSamples = encoder.getLookahead();
    if (
      Number.isSafeInteger(primingSamples) === false ||
      primingSamples < 0 ||
      primingSamples >= encoder.frameSize
    )
      throw new Error(
        "Pinned Opus runtime returned an invalid encoder lookahead.",
      );
    const sampleFrames = data.pcm.length / encoder.channels;
    const codedSampleFrames =
      Math.ceil((sampleFrames + primingSamples) / encoder.frameSize) *
      encoder.frameSize;
    const packets: IOpusGenerationPacket[] = [];
    for (let dts = 0; dts < codedSampleFrames; dts += encoder.frameSize) {
      const frame = new Float32Array(encoder.frameSize * encoder.channels);
      frame.set(
        data.pcm.subarray(
          dts * encoder.channels,
          Math.min(
            data.pcm.length,
            (dts + encoder.frameSize) * encoder.channels,
          ),
        ),
      );
      packets.push({
        bytes: Uint8Array.from(encoder.encodeFloat(frame)),
        duration: encoder.frameSize,
        dts,
      });
    }
    result = { codedSampleFrames, packets, primingSamples };
  } catch (error) {
    operationFailure = { error };
  }
  let cleanupFailure: { error: unknown } | undefined;
  try {
    encoder.free();
  } catch (error) {
    cleanupFailure = { error };
  }
  let postcheckFailure: { error: unknown } | undefined;
  try {
    assertRuntimePackageSnapshotCurrent(snapshot);
  } catch (error) {
    postcheckFailure = { error };
  }
  const failures = [
    operationFailure?.error,
    cleanupFailure?.error,
    postcheckFailure?.error,
  ].filter((error): error is unknown => error !== undefined);
  if (failures.length > 1)
    throw new OpusGenerationOperationError(
      failures,
      "Opus generation failed across operation, cleanup, or package postcheck.",
    );
  if (failures.length === 1) throw failures[0];
  return result!;
};

const isOpusWorkerData = (value: unknown): value is IOpusGenerationWorkerData =>
  typeof value === "object" &&
  value !== null &&
  "protocol" in value &&
  value.protocol === "automovie.opus-generation-worker.v1";

if (isMainThread === false && isOpusWorkerData(workerData))
  void serveOpusGenerationWorker(workerData).then(
    (result) =>
      parentPort?.postMessage({
        kind: "encoded",
        result,
      } satisfies OpusGenerationWorkerResponse),
    (error: unknown) =>
      parentPort?.postMessage({
        kind: "failed",
        message: error instanceof Error ? error.message : String(error),
      } satisfies OpusGenerationWorkerResponse),
  );
