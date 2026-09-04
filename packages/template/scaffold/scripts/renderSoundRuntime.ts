import {
  productionPhonemesToVisemes,
  productionSoundSpectrogram,
  productionSoundWaveform,
  renderProductionSound,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import {
  type AutoMovieProductionProject,
  type IAutoMovieProductionAudioAssetIdentity,
  type IAutoMovieProductionRenderJobPlan,
  assertAutoMovieExternalGeneratorTermsAt,
  decodeProductionAudioAsset,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  readAutoMovieFilmTimeline,
  trimProductionAudioPresentation,
} from "@automovie/production";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
  type IDialogueCacheSnapshot,
  captureExistingDialogueCache,
  publishDialogueCache,
} from "./dialogueCacheSnapshot";
import {
  type IProductionDialogueCacheFinding,
  type IProductionDialogueCacheIdentity,
  type IProductionDialogueCacheRecord,
  PRODUCTION_DIALOGUE_CACHE_VERSION,
  inspectProductionDialogueCache,
  productionDialogueCacheIdentity,
  validateProductionDialogueCache,
} from "./dialogueCacheTextIdentity";
import { loadKokoroRuntime } from "./loadKokoroRuntime";
import {
  type IAutoMovieDialogueSynthesisSelection,
  AUTOMOVIE_DIALOGUE_MODEL_REVISION as KOKORO_MODEL_REVISION,
  assertProductionDialogueSynthesis,
  assertProductionLiveWearableSoftBodies,
  assertProductionSpeakerBindings,
  type readProductionSpeakerBindings,
} from "./productionConfiguration";
import {
  compileProductionDialogueRuntime,
  deriveProductionRuntimeSoundPlan,
  productionDialogueRuntimeIdentity,
} from "./productionRuntime";
import type { IAutoMovieProductionDialogueRuntime } from "./productionRuntimeState";
import {
  productionAcousticBindings,
  productionAcousticStudies,
} from "./productionStudies";
import {
  type IRenderGcTargetSnapshot,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  ensureRenderPhysicalDirectory,
} from "./renderGcSnapshot";
import type { IProductionRenderHost } from "./renderHost";
import {
  type IRuntimePackageSnapshot,
  type RuntimePackageAssetSelection,
  assertRuntimePackageSnapshotCurrent,
  bindRuntimePackageSnapshotGeneration,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

export interface IProductionRenderEncoderRuntime {
  assertCurrent: (plan: IAutoMovieProductionRenderJobPlan) => void;
  encodeOpus: (pcm: Float32Array) => Promise<Uint8Array>;
  encodePngFrames: (
    produceFrames: (
      consumeFrame: (frame: Uint8Array) => void,
    ) => void | Promise<void>,
    plan: IAutoMovieProductionRenderJobPlan,
  ) => Promise<Uint8Array>;
}

export interface IProductionSoundBundle {
  plan: IAutoMovieProductionSoundPlan;
  analysis: IAutoMovieProductionSoundAnalysis;
  tts: IAutoMovieProductionTtsReceipt[];
  audio: Uint8Array;
  waveform: Uint8Array;
  spectrogram: Uint8Array;
}

export interface IPreparedProductionSoundRuntime {
  dialogueRuntime: IAutoMovieProductionDialogueRuntime;
  plan: IAutoMovieProductionSoundPlan;
  synthesized: {
    pcm: Map<string, Float32Array>;
    receipts: IAutoMovieProductionTtsReceipt[];
  };
}

class ProductionRuntimeClosureError extends AggregateError {}
class ProductionDialogueCacheObservationError extends Error {}

interface IResidentRuntimePackage<Module> {
  module: Module;
  snapshot: IRuntimePackageSnapshot;
}

const residentRequire = createRequire(import.meta.url);
const residentRuntimePackages = new Map<
  string,
  IResidentRuntimePackage<unknown>
>();

/** Snapshot and bind a package generation before Node is allowed to load it. */
const residentRuntimePackage = <Module>(
  packageName: string,
): IResidentRuntimePackage<Module> => {
  const existing = residentRuntimePackages.get(packageName);
  if (existing !== undefined) {
    assertRuntimePackageSnapshotCurrent(existing.snapshot);
    return existing as IResidentRuntimePackage<Module>;
  }
  const snapshot = snapshotRuntimePackage({
    entry: residentRequire.resolve(packageName),
    moduleClosure: true,
    packageName,
  });
  bindRuntimePackageSnapshotGeneration(snapshot);
  const loaded = {
    module: residentRequire(packageName) as Module,
    snapshot,
  };
  residentRuntimePackages.set(packageName, loaded);
  return loaded;
};

/** Revalidate one runtime closure without replacing an operation failure. */
export const runWithProductionRuntimeClosure = async <Output>(
  assertCurrent: () => void,
  operation: () => Output | Promise<Output>,
): Promise<Output> => {
  assertCurrent();
  let failure: unknown;
  let output: Output | undefined;
  try {
    output = await operation();
  } catch (error) {
    failure = error;
  }
  try {
    assertCurrent();
  } catch (closureFailure) {
    if (failure === undefined) throw closureFailure;
    throw new ProductionRuntimeClosureError(
      [failure, closureFailure],
      "Production runtime closure changed after the operation failed.",
      { cause: failure },
    );
  }
  if (failure !== undefined) throw failure;
  return output!;
};

/** Bind render-owned content and one explicit dialogue runtime into one source. */
export const productionSoundSourceDigest = (props: {
  project: AutoMovieProductionProject;
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
  runtimeIdentity: unknown;
  dialogueRuntime: IAutoMovieProductionDialogueRuntime;
}): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        content: props.project
          .contentInputs()
          .filter((input) => {
            const audio = new Set(
              props.timeline.tracks.audio.map((cue) => cue.asset),
            );
            return input.render && audio.has(input.path) === false;
          })
          .map((input) => ({
            path: input.path,
            digest:
              input.bytes === null ? null : digestAutoMovieBytes(input.bytes),
          })),
        soundRuntime: props.runtimeIdentity,
        dialogueRuntime: productionDialogueRuntimeIdentity(
          props.dialogueRuntime,
        ),
        acousticStudies: productionAcousticStudies,
        acousticBindings: productionAcousticBindings,
      }),
      "utf8",
    ),
  );

/** Re-key a cache miss after runtime loading changes the executable asset set. */
export const resolveProductionDialogueCache = async <Runtime, Cached>(props: {
  assets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  identify: (
    assets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
  ) => IProductionDialogueCacheIdentity;
  load: () => Promise<Runtime>;
  read: (
    identity: IProductionDialogueCacheIdentity,
    assets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
  ) => Cached | undefined;
  runtimeAssets: (
    runtime: Runtime,
  ) => IAutoMovieProductionTtsReceipt["runtimeAssets"];
}): Promise<{
  assets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  cached: Cached | undefined;
  identity: IProductionDialogueCacheIdentity;
  runtime: Runtime | undefined;
}> => {
  let assets = props.assets;
  let identity = props.identify(assets);
  let cached = props.read(identity, assets);
  if (cached !== undefined)
    return { assets, cached, identity, runtime: undefined };
  const runtime = await props.load();
  assets = props.runtimeAssets(runtime);
  const loadedIdentity = props.identify(assets);
  if (loadedIdentity.key !== identity.key) {
    identity = loadedIdentity;
    cached = props.read(identity, assets);
  }
  return { assets, cached, identity, runtime };
};

export interface IProductionSoundRuntime {
  assertCurrent: () => void;
  audioAssets: (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
  ) => IAutoMovieProductionAudioAssetIdentity[];
  audioSources: (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
    sampleRate: number,
  ) => Array<{
    identity: IAutoMovieProductionAudioAssetIdentity;
    samples: Float32Array | null;
  }>;
  cacheRetention: (
    input: IProductionSoundRuntimeInput,
  ) => IProductionSoundCacheRetention;
  inspectCurrent: (
    input: IProductionSoundRuntimeInput,
  ) => IProductionSoundCurrentInspection;
  prepare: (
    input: IProductionSoundRuntimeInput,
  ) => Promise<IPreparedProductionSoundRuntime>;
  runtimeIdentity: () => unknown;
  sourceDigest: (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
    dialogueRuntime: IAutoMovieProductionDialogueRuntime,
  ) => AutoMovieContentDigest;
}

export interface IProductionSoundRuntimeInput {
  project: AutoMovieProductionProject;
  compileFingerprint: AutoMovieContentDigest;
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
}

export interface IProductionSoundCacheRetention {
  assertCurrent: () => void;
  dialoguePaths: readonly string[];
  modelPaths: readonly string[];
}

export type IProductionSoundCurrentInspection =
  | (IProductionSoundCacheRetention & {
      status: "current";
      audioAssets: IAutoMovieProductionAudioAssetIdentity[];
      dialogueRuntime: IAutoMovieProductionDialogueRuntime;
      plan: IAutoMovieProductionSoundPlan;
      runtimeIdentity: unknown;
      sourceDigest: AutoMovieContentDigest;
    })
  | (IProductionSoundCacheRetention & {
      status: "not-ready";
      correction: string;
    });

/** Own source decoding, TTS preparation, caches, and runtime identity per invocation. */
export const createProductionSoundRuntime = (props: {
  dialogueSelection: IAutoMovieDialogueSynthesisSelection | null;
  host: IProductionRenderHost;
  liveWearableSoftBodies: Parameters<
    typeof assertProductionLiveWearableSoftBodies
  >[0]["selected"];
  productionStateRoot: string;
  progress: (
    stage: string,
    details?: Readonly<Record<string, number | string>>,
  ) => void;
  speakerBindings: ReturnType<typeof readProductionSpeakerBindings>;
}): IProductionSoundRuntime => {
  const resolveImportEntry = (packageName: string): string =>
    fileURLToPath(import.meta.resolve(packageName));

  const compareCodeUnits = (left: string, right: string): number =>
    left < right ? -1 : left > right ? 1 : 0;

  const placeholderAudioStem = (
    asset: string,
    bytes: Uint8Array,
  ): {
    durationSeconds: number;
    sampleRate: number;
    channels: number;
  } | null => {
    const lead = bytes.find(
      (byte) =>
        byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d,
    );
    if (lead !== 0x7b) return null;
    let metadata: unknown;
    try {
      metadata = JSON.parse(Buffer.from(bytes).toString("utf8"));
    } catch {
      return null;
    }
    const value = metadata as Partial<{
      kind: string;
      durationSeconds: number;
      sampleRate: number;
      channels: number;
    }> | null;
    if (value?.kind !== "placeholder-audio-stem") return null;
    if (
      Number.isFinite(value.durationSeconds) === false ||
      Number.isSafeInteger(value.sampleRate) === false ||
      Number.isSafeInteger(value.channels) === false ||
      value.sampleRate !== 48_000 ||
      value.channels !== 2
    )
      throw new Error(
        `Audio asset "${asset}" must declare one 48 kHz stereo deterministic guide stem and finite duration.`,
      );
    return {
      durationSeconds: value.durationSeconds!,
      sampleRate: value.sampleRate,
      channels: value.channels,
    };
  };

  const audioSources: IProductionSoundRuntime["audioSources"] = (
    project,
    timeline,
    sampleRate,
  ) => {
    const inputs = new Map(
      project.contentInputs().map((input) => [input.path, input.bytes]),
    );
    return [...new Set(timeline.tracks.audio.map((cue) => cue.asset))]
      .sort(compareCodeUnits)
      .map((asset) => {
        const bytes = inputs.get(asset);
        if (bytes === undefined || bytes === null)
          throw new Error(
            `Audio asset "${asset}" has no current compiler-owned bytes.`,
          );
        const digest = digestAutoMovieBytes(bytes);
        const stem = placeholderAudioStem(asset, bytes);
        if (stem !== null)
          return {
            identity: {
              kind: "placeholder-audio-stem" as const,
              path: asset,
              digest,
              ...stem,
            },
            samples: null,
          };
        const decoded = decodeProductionAudioAsset({
          path: asset,
          bytes,
          sampleRate,
        });
        return {
          identity: {
            path: asset,
            digest,
            durationSeconds: decoded.durationSeconds,
            sampleRate: decoded.sourceSampleRate,
            channels: decoded.sourceChannels,
            kind: "wave",
            sourceFormat: decoded.sourceFormat,
            processing: decoded.processing,
          },
          samples: decoded.samples,
        };
      });
  };

  const packageSnapshotIdentity = (
    snapshot: IRuntimePackageSnapshot,
  ): {
    package: string;
    version: string;
    closureDigest: AutoMovieContentDigest;
  } => ({
    package: snapshot.package,
    version: snapshot.version,
    closureDigest: snapshot.contentFingerprint,
  });

  const packageSnapshots = new Map<string, IRuntimePackageSnapshot>();

  const resolvedPackageSnapshot = (
    packageName: string,
    assets: readonly RuntimePackageAssetSelection[] = [],
    options: {
      entry?: string;
      packageExports?: boolean;
    } = {},
  ): IRuntimePackageSnapshot => {
    const entry = options.entry ?? resolveImportEntry(packageName);
    const key = `${packageName}\0${entry}\0${options.packageExports === true}\0${JSON.stringify(assets)}`;
    const existing = packageSnapshots.get(key);
    if (existing !== undefined) {
      assertRuntimePackageSnapshotCurrent(existing);
      return existing;
    }
    const snapshot = snapshotRuntimePackage({
      assets,
      entry,
      moduleClosure: true,
      packageExports: options.packageExports,
      packageName,
    });
    bindRuntimePackageSnapshotGeneration(snapshot);
    packageSnapshots.set(key, snapshot);
    return snapshot;
  };

  const assertCurrentRuntimePackages = (): void => {
    for (const snapshot of packageSnapshots.values())
      assertRuntimePackageSnapshotCurrent(snapshot);
  };

  const resolvedPackageIdentity = (packageName: string) =>
    packageSnapshotIdentity(resolvedPackageSnapshot(packageName));

  const resolvedDependencySnapshot = (
    importer: IRuntimePackageSnapshot,
    packageName: string,
  ): IRuntimePackageSnapshot =>
    resolvedPackageSnapshot(packageName, [], {
      entry: createRequire(importer.entry).resolve(packageName),
      packageExports: true,
    });

  const onnxRuntimeNodeIdentity = (): ReturnType<
    typeof packageSnapshotIdentity
  > & {
    nativeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  } => {
    const relative = [
      "bin",
      "napi-v3",
      props.host.platform,
      props.host.arch,
    ].join("/");
    let snapshot: IRuntimePackageSnapshot;
    try {
      snapshot = resolvedPackageSnapshot("onnxruntime-node", [
        { kind: "tree", relative },
      ]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(
          `ONNX Runtime Node has no native backend for ${props.host.platform}/${props.host.arch}.`,
        );
      throw error;
    }
    if (snapshot.assets.length === 0)
      throw new Error(
        `ONNX Runtime Node native backend is empty for ${props.host.platform}/${props.host.arch}.`,
      );
    return {
      ...packageSnapshotIdentity(snapshot),
      nativeAssets: snapshot.assets.map((asset) => ({
        path: `package:onnxruntime-node/${asset.path}`,
        digest: asset.digest,
      })),
    };
  };

  const runtimeIdentity = () => ({
    protocol: "automovie.production-sound.v2",
    sampleRate: 48_000,
    channels: 2,
    opus: {
      ...resolvedPackageIdentity("libopus-wasm"),
      bitrate: 128_000,
      complexity: 10,
      vbr: false,
      frameSize: 960,
    },
    mux: packageSnapshotIdentity(
      residentRuntimePackage<typeof import("mp4box")>("mp4box").snapshot,
    ),
    evidencePng: packageSnapshotIdentity(
      residentRuntimePackage<typeof import("pngjs")>("pngjs").snapshot,
    ),
    tts: (() => {
      if (props.dialogueSelection === null) return null;
      const kokoro = resolvedPackageSnapshot("kokoro-js");
      const adapter = resolvedPackageSnapshot("@huggingface/transformers");
      return {
        ...packageSnapshotIdentity(kokoro),
        adapter: packageSnapshotIdentity(adapter),
        backend: onnxRuntimeNodeIdentity(),
        dependencies: [
          packageSnapshotIdentity(
            resolvedDependencySnapshot(kokoro, "phonemizer"),
          ),
          packageSnapshotIdentity(
            resolvedDependencySnapshot(adapter, "onnxruntime-common"),
          ),
        ],
        imageCapability: resolvedPackageIdentity("sharp"),
        ...props.dialogueSelection,
      };
    })(),
  });

  const assertSoundRuntimeCurrent = (): void => {
    void runtimeIdentity();
    assertCurrentRuntimePackages();
  };

  const captureKokoroModelCache = (
    modelCacheRoot: string,
  ): IRenderGcTargetSnapshot | null => {
    try {
      return captureRenderGcTarget(props.productionStateRoot, modelCacheRoot);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" ||
        (error as NodeJS.ErrnoException).code === "ENOTDIR"
      )
        return null;
      throw error;
    }
  };

  const kokoroModelCacheAssets = (
    snapshot: IRenderGcTargetSnapshot | null,
  ): IAutoMovieProductionTtsReceipt["runtimeAssets"] => {
    if (snapshot === null) return [];
    if (snapshot.kind !== "directory")
      throw new Error("Kokoro model cache revision is not a physical tree.");
    const output = snapshot.entries.flatMap((entry) =>
      entry.kind === "file" && entry.digest !== undefined
        ? [{ path: `model:${entry.path}`, digest: entry.digest }]
        : [],
    );
    assertCapturedRenderTarget(snapshot);
    return output;
  };

  const kokoroBaseRuntimeAssets = (
    voiceId: string,
  ): IAutoMovieProductionTtsReceipt["runtimeAssets"] => {
    const voiceRelative = `voices/${voiceId}.bin`;
    const kokoro = resolvedPackageSnapshot("kokoro-js", [
      { kind: "file", relative: voiceRelative },
    ]);
    const transformersSnapshot = resolvedPackageSnapshot(
      "@huggingface/transformers",
    );
    const transformers = packageSnapshotIdentity(transformersSnapshot);
    const backend = onnxRuntimeNodeIdentity();
    const imageCapability = resolvedPackageIdentity("sharp");
    const phonemizer = packageSnapshotIdentity(
      resolvedDependencySnapshot(kokoro, "phonemizer"),
    );
    const onnxCommon = packageSnapshotIdentity(
      resolvedDependencySnapshot(transformersSnapshot, "onnxruntime-common"),
    );
    const voice = kokoro.assets.find((asset) => asset.path === voiceRelative);
    if (voice === undefined)
      throw new Error(`Kokoro voice asset is absent: ${voiceRelative}`);
    return [
      { path: "package:kokoro-js", digest: kokoro.contentFingerprint },
      {
        path: "package:@huggingface/transformers",
        digest: transformers.closureDigest,
      },
      {
        path: "package:onnxruntime-node",
        digest: backend.closureDigest,
      },
      {
        path: "package:onnxruntime-common",
        digest: onnxCommon.closureDigest,
      },
      ...backend.nativeAssets,
      {
        path: "package:phonemizer",
        digest: phonemizer.closureDigest,
      },
      {
        path: "package:sharp-capability-wall",
        digest: imageCapability.closureDigest,
      },
      { path: `voice:${voiceId}.bin`, digest: voice.digest },
    ];
  };

  interface IKokoroRuntime {
    stream(
      text: IKokoroTextSplitter,
      options: { voice: string; speed: number },
    ): AsyncIterable<{
      text: string;
      phonemes: string;
      audio: { audio: Float32Array; sampling_rate: number };
    }>;
  }

  interface IKokoroTextSplitter extends AsyncIterable<string> {
    push(...texts: string[]): void;
    close(): void;
  }

  interface IKokoroLoadedRuntime {
    runtime: IKokoroRuntime;
    createTextSplitter(): IKokoroTextSplitter;
    runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  }

  const publicDialogueCacheRecord = ({
    requestText: _requestText,
    ...record
  }: IProductionDialogueCacheRecord): Omit<
    IProductionDialogueCacheRecord,
    "requestText"
  > => record;

  const dialogueReceipt = (
    line: IAutoMovieProductionSoundPlan["dialogue"][number],
    cached: Extract<
      ReturnType<typeof validateProductionDialogueCache>,
      { status: "current" }
    >["cached"],
  ): IAutoMovieProductionTtsReceipt => ({
    ...publicDialogueCacheRecord(cached.record),
    version: 6,
    line: line.id,
    visemes: productionPhonemesToVisemes({
      chunks: cached.record.phonemeChunks,
      sourceSamples: cached.record.sourceSamples,
      startFrame: line.startFrame,
      endFrame: line.endFrame,
    }),
  });

  const dialogueCacheObservationFailure = (
    line: string,
    finding: Exclude<
      IProductionDialogueCacheFinding,
      { status: "absent" | "current" | "stale" }
    >,
  ): Error =>
    new ProductionDialogueCacheObservationError(
      `Dialogue cache observation failed at stage "cache-read" for line "${line}", target "${finding.identity.path}", generation ${finding.identity.key}: ${
        finding.status === "integrity-failed" ? finding.reason : finding.status
      }. Preserve the generation and recover or quarantine it manually.`,
      "error" in finding ? { cause: finding.error } : undefined,
    );

  const loadPinnedKokoroRuntime = async (
    modelCacheRoot: string,
    baseRuntimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
    selection: IAutoMovieDialogueSynthesisSelection,
  ): Promise<IKokoroLoadedRuntime> => {
    ensureRenderPhysicalDirectory(
      props.productionStateRoot,
      path
        .relative(props.productionStateRoot, modelCacheRoot)
        .split(path.sep)
        .join("/"),
    );
    props.progress("sound.model.load.start", {
      model: selection.model,
      revision: selection.modelRevision,
    });
    const [
      { KokoroTTS, TextSplitterStream },
      { AutoTokenizer, StyleTextToSpeech2Model },
    ] = await Promise.all([
      import("kokoro-js"),
      import("@huggingface/transformers"),
    ]);
    const loaded = await loadKokoroRuntime({
      factories: {
        loadModel: (model, options) =>
          StyleTextToSpeech2Model.from_pretrained(model, options),
        loadTokenizer: (model, options) =>
          AutoTokenizer.from_pretrained(model, options),
        construct: (model, tokenizer) =>
          new KokoroTTS(
            model as InstanceType<typeof StyleTextToSpeech2Model>,
            tokenizer,
          ),
      },
      model: selection.model,
      revision: selection.modelRevision,
      cacheRoot: modelCacheRoot,
      dtype: selection.dtype,
      device: selection.device,
    });
    assertCurrentRuntimePackages();
    const modelSnapshot = captureKokoroModelCache(modelCacheRoot);
    const modelAssets = kokoroModelCacheAssets(modelSnapshot);
    if (modelAssets.length === 0)
      throw new Error(
        "Pinned Kokoro load produced no revision-scoped model cache assets.",
      );
    props.progress("sound.model.load.complete", {
      model: selection.model,
      revision: selection.modelRevision,
    });
    const output = {
      runtime: loaded as unknown as IKokoroRuntime,
      createTextSplitter: () => new TextSplitterStream(),
      runtimeAssets: [...baseRuntimeAssets, ...modelAssets],
    };
    assertCurrentRuntimePackages();
    if (modelSnapshot !== null) assertCapturedRenderTarget(modelSnapshot);
    return output;
  };

  const synthesizeProductionDialogue = async (
    plan: IAutoMovieProductionSoundPlan,
    selection: IAutoMovieDialogueSynthesisSelection | null,
  ): Promise<{
    pcm: Map<string, Float32Array>;
    receipts: IAutoMovieProductionTtsReceipt[];
  }> => {
    const pcm = new Map<string, Float32Array>();
    const receipts: IAutoMovieProductionTtsReceipt[] = [];
    if (plan.dialogue.length !== 0 && selection === null)
      throw new Error(
        "Dialogue lines require an explicit sound.dialogueSynthesis selection.",
      );
    if (selection === null) return { pcm, receipts };
    const cacheRoot = ensureRenderPhysicalDirectory(
      props.productionStateRoot,
      "audio-cache/kokoro",
    );
    const modelCacheRoot = path.join(
      props.productionStateRoot,
      "model-cache",
      "kokoro",
      KOKORO_MODEL_REVISION,
    );
    const baseRuntimeAssets = kokoroBaseRuntimeAssets(selection.voice);
    let runtime: Promise<IKokoroLoadedRuntime> | undefined;
    const currentRuntime = (): Promise<IKokoroLoadedRuntime> =>
      (runtime ??= loadPinnedKokoroRuntime(
        modelCacheRoot,
        baseRuntimeAssets,
        selection,
      ));
    let runtimeAssets = [
      ...baseRuntimeAssets,
      ...kokoroModelCacheAssets(captureKokoroModelCache(modelCacheRoot)),
    ];
    if (
      plan.dialogue.length > 0 &&
      runtimeAssets.length === baseRuntimeAssets.length
    )
      runtimeAssets = (await currentRuntime()).runtimeAssets;
    for (const line of plan.dialogue) {
      props.progress("sound.dialogue.start", { line: line.id });
      const cacheIdentity = (
        assets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
      ) =>
        productionDialogueCacheIdentity({
          cacheRoot,
          selection,
          text: line.text,
          language: line.language,
          speaker: line.speaker ?? null,
          runtimeAssets: assets,
        });
      const resolved = await resolveProductionDialogueCache({
        assets: runtimeAssets,
        identify: cacheIdentity,
        load: currentRuntime,
        read: (identity, assets) => {
          const finding = inspectProductionDialogueCache({
            identity,
            runtimeAssets: assets,
            selection,
            read: () => captureExistingDialogueCache(cacheRoot, identity.path),
          });
          if (finding.status === "current") return finding.cached;
          if (finding.status === "absent" || finding.status === "stale")
            return undefined;
          throw dialogueCacheObservationFailure(line.id, finding);
        },
        runtimeAssets: (loaded) => loaded.runtimeAssets,
      });
      runtimeAssets = resolved.assets;
      const identity = resolved.identity;
      let cached = resolved.cached;
      let loadedRuntime = resolved.runtime;
      if (cached === undefined) {
        loadedRuntime ??= await currentRuntime();
        const dialogueText = loadedRuntime.createTextSplitter();
        dialogueText.push(identity.requestText);
        dialogueText.close();
        const generatedAt = new Date(props.host.now()).toISOString();
        assertAutoMovieExternalGeneratorTermsAt({
          termsCheckedAt: selection.generatorProvenance.termsCheckedAt,
          occurredAt: generatedAt,
          label: "Kokoro dialogue generation generatorProvenance",
        });
        const chunks: Float32Array[] = [];
        const phonemes: string[] = [];
        const phonemeChunks: IProductionDialogueCacheRecord["phonemeChunks"] =
          [];
        let sourceSampleRate: number | undefined;
        let sourceOffset = 0;
        const stream = loadedRuntime.runtime.stream(dialogueText, {
          voice: selection.voice,
          speed: selection.speed,
        });
        for await (const chunk of stream) {
          if (
            Number.isSafeInteger(chunk.audio.sampling_rate) === false ||
            chunk.audio.sampling_rate <= 0
          )
            throw new Error(
              `Kokoro line "${line.id}" returned an invalid PCM sample rate.`,
            );
          if (
            sourceSampleRate !== undefined &&
            sourceSampleRate !== chunk.audio.sampling_rate
          )
            throw new Error(
              `Kokoro line "${line.id}" changed PCM sample rate mid-stream.`,
            );
          sourceSampleRate = chunk.audio.sampling_rate;
          const audio = Float32Array.from(chunk.audio.audio);
          if (audio.length === 0)
            throw new Error(
              `Kokoro line "${line.id}" returned an empty PCM chunk.`,
            );
          for (let index = 0; index < audio.length; ++index)
            if (Number.isFinite(audio[index]) === false)
              throw new Error(
                `Kokoro line "${line.id}" returned a non-finite PCM sample at source index ${sourceOffset + index}.`,
              );
          chunks.push(audio);
          phonemes.push(chunk.phonemes);
          phonemeChunks.push({
            phonemes: chunk.phonemes,
            startSample: sourceOffset,
            endSample: sourceOffset + audio.length,
          });
          sourceOffset += audio.length;
        }
        if (sourceSampleRate === undefined || chunks.length === 0)
          throw new Error(`Kokoro synthesized no PCM for line "${line.id}".`);
        const samples = concatenateProductionFloat32(chunks);
        const bytes = new Uint8Array(
          samples.buffer,
          samples.byteOffset,
          samples.byteLength,
        );
        const record: IProductionDialogueCacheRecord = {
          version: PRODUCTION_DIALOGUE_CACHE_VERSION,
          requestText: identity.requestText,
          cacheKey: identity.key,
          model: selection.model,
          modelRevision: selection.modelRevision,
          voice: selection.voice,
          generatorProvenance: selection.generatorProvenance,
          generatedAt,
          sourceSampleRate,
          sourceSamples: samples.length,
          pcmDigest: digestAutoMovieBytes(bytes),
          phonemes: phonemes.join(""),
          phonemeChunks,
          runtimeAssets,
        };
        const receipt = Buffer.from(
          `${JSON.stringify(record, null, 2)}\n`,
          "utf8",
        );
        const stagedValidation = validateProductionDialogueCache({
          snapshot: { pcm: bytes, receipt },
          identity,
          runtimeAssets,
          selection,
        });
        if (stagedValidation.status !== "current")
          throw new Error(
            `Kokoro generation for line "${line.id}" failed cache protocol validation before publication: ${stagedValidation.reason}.`,
          );
        const published = publishDialogueCache({
          base: cacheRoot,
          pcm: bytes,
          receipt,
          target: identity.path,
        });
        const validation = validateProductionDialogueCache({
          snapshot: published,
          identity,
          runtimeAssets,
          selection,
        });
        if (validation.status !== "current")
          throw new Error(
            `Published Kokoro cache generation for line "${line.id}" is invalid.`,
          );
        cached = validation.cached;
      }
      pcm.set(line.id, cached.samples);
      receipts.push(dialogueReceipt(line, cached));
      props.progress("sound.dialogue.complete", { line: line.id });
    }
    return { pcm, receipts };
  };

  const readProductionCompiledShots = (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
  ): Map<string, IAutoMovieCompiledShotSource> =>
    new Map(
      [...new Set(timeline.segments.map((segment) => segment.shot))].map(
        (shot) => [
          shot,
          JSON.parse(
            Buffer.from(
              project.readGeneratedFile(
                `shots/${encodeAutoMoviePathSegment(shot)}.json`,
              ),
            ).toString("utf8"),
          ) as IAutoMovieCompiledShotSource,
        ],
      ),
    );

  const deriveCurrentSoundPlan = (input: IProductionSoundRuntimeInput) => {
    const graph = input.project.graph();
    const production = graph.production;
    if (production === null)
      throw new Error("Production sound planning requires a design.");
    const compiled = readProductionCompiledShots(input.project, input.timeline);
    assertProductionLiveWearableSoftBodies({
      selected: props.liveWearableSoftBodies,
      shots: compiled,
    });
    const plan = deriveProductionRuntimeSoundPlan({
      timeline: input.timeline,
      contracts: graph.shots,
      compiled,
      sound: production.sound,
      acousticStudies: productionAcousticStudies,
      acousticBindings: productionAcousticBindings,
    });
    const selection = assertProductionDialogueSynthesis({
      selected: props.dialogueSelection,
      dialogue: plan.dialogue,
    });
    assertProductionSpeakerBindings({
      bindings: props.speakerBindings,
      dialogue: plan.dialogue,
      timeline: input.timeline,
      shots: compiled,
    });
    return { graph, plan, selection };
  };

  const inspectCurrent = (
    input: IProductionSoundRuntimeInput,
  ): IProductionSoundCurrentInspection => {
    const { plan, selection } = deriveCurrentSoundPlan(input);
    const installedRuntimeIdentity = runtimeIdentity();
    const audioAssets = audioSources(input.project, input.timeline, 48_000).map(
      (source) => source.identity,
    );
    if (selection === null || plan.dialogue.length === 0) {
      const dialogueRuntime = compileProductionDialogueRuntime({
        plan,
        timeline: input.timeline,
        receipts: [],
        bindings: props.speakerBindings,
      });
      return {
        assertCurrent: assertSoundRuntimeCurrent,
        audioAssets,
        dialoguePaths: [],
        dialogueRuntime,
        modelPaths: [],
        plan,
        runtimeIdentity: installedRuntimeIdentity,
        sourceDigest: productionSoundSourceDigest({
          project: input.project,
          timeline: input.timeline,
          runtimeIdentity: installedRuntimeIdentity,
          dialogueRuntime,
        }),
        status: "current",
      };
    }
    const modelCacheRoot = path.join(
      props.productionStateRoot,
      "model-cache",
      "kokoro",
      KOKORO_MODEL_REVISION,
    );
    const modelSnapshot = captureKokoroModelCache(modelCacheRoot);
    const modelAssets = kokoroModelCacheAssets(modelSnapshot);
    if (modelSnapshot === null || modelAssets.length === 0)
      return {
        assertCurrent: assertSoundRuntimeCurrent,
        correction:
          "Run a dialogue-producing render action to materialize the pinned Kokoro model generation before verifying this plan.",
        dialoguePaths: [],
        modelPaths: [],
        status: "not-ready",
      };
    const cacheRoot = path.join(
      props.productionStateRoot,
      "audio-cache",
      "kokoro",
    );
    const runtimeAssets = [
      ...kokoroBaseRuntimeAssets(selection.voice),
      ...modelAssets,
    ];
    const dialogueSnapshots: IDialogueCacheSnapshot[] = [];
    const receipts: IAutoMovieProductionTtsReceipt[] = [];
    const dialoguePaths = plan.dialogue.flatMap((line) => {
      const identity = productionDialogueCacheIdentity({
        cacheRoot,
        selection,
        text: line.text,
        language: line.language,
        speaker: line.speaker ?? null,
        runtimeAssets,
      });
      const finding = inspectProductionDialogueCache({
        identity,
        runtimeAssets,
        selection,
        read: () => captureExistingDialogueCache(cacheRoot, identity.path),
      });
      if (finding.status === "absent") return [];
      if (finding.status === "stale") {
        dialogueSnapshots.push(finding.snapshot);
        return [`audio-cache/kokoro/${identity.key.slice(7)}`];
      }
      if (finding.status !== "current")
        throw dialogueCacheObservationFailure(line.id, finding);
      dialogueSnapshots.push(finding.snapshot);
      receipts.push(dialogueReceipt(line, finding.cached));
      return [`audio-cache/kokoro/${identity.key.slice(7)}`];
    });
    const retention: IProductionSoundCacheRetention = {
      assertCurrent: () => {
        assertSoundRuntimeCurrent();
        assertCapturedRenderTarget(modelSnapshot);
        for (const snapshot of dialogueSnapshots)
          assertCapturedRenderTarget(snapshot.snapshot);
      },
      dialoguePaths,
      modelPaths: [`model-cache/kokoro/${KOKORO_MODEL_REVISION}`],
    };
    if (receipts.length !== plan.dialogue.length)
      return {
        ...retention,
        status: "not-ready",
        correction:
          "Run a dialogue-producing render action to synthesize every current v6 Kokoro cache generation before verifying this plan.",
      };
    const dialogueRuntime = compileProductionDialogueRuntime({
      plan,
      timeline: input.timeline,
      receipts,
      bindings: props.speakerBindings,
    });
    return {
      ...retention,
      status: "current",
      audioAssets,
      dialogueRuntime,
      plan,
      runtimeIdentity: installedRuntimeIdentity,
      sourceDigest: productionSoundSourceDigest({
        project: input.project,
        timeline: input.timeline,
        runtimeIdentity: installedRuntimeIdentity,
        dialogueRuntime,
      }),
    };
  };

  const cacheRetention = (
    input: IProductionSoundRuntimeInput,
  ): IProductionSoundCacheRetention => {
    const inspected = inspectCurrent(input);
    return {
      assertCurrent: inspected.assertCurrent,
      dialoguePaths: inspected.dialoguePaths,
      modelPaths: inspected.modelPaths,
    };
  };

  let prepared:
    | {
        identity: AutoMovieContentDigest;
        value: Promise<
          IPreparedProductionSoundRuntime & {
            bindings: typeof props.speakerBindings;
          }
        >;
      }
    | undefined;
  const prepare: IProductionSoundRuntime["prepare"] = async (input) => {
    const { graph, plan, selection } = deriveCurrentSoundPlan(input);
    const production = graph.production!;
    const identity = digestAutoMovieBytes(
      Buffer.from(
        JSON.stringify({
          compileFingerprint: input.compileFingerprint,
          sound: production.sound ?? null,
          dialogueSynthesis: props.dialogueSelection,
          speakerBindings: props.speakerBindings,
          liveWearableSoftBodies: props.liveWearableSoftBodies,
          acousticStudies: productionAcousticStudies,
          acousticBindings: productionAcousticBindings,
        }),
        "utf8",
      ),
    );
    if (prepared?.identity !== identity) {
      prepared = {
        identity,
        value: (async () => {
          props.progress("sound.runtime.prepare.start");
          props.progress("sound.plan.complete", {
            dialogueLines: plan.dialogue.length,
          });
          props.progress("sound.synthesis.start");
          const synthesized = await synthesizeProductionDialogue(
            plan,
            selection,
          );
          props.progress("sound.synthesis.complete");
          props.progress("sound.runtime.prepare.complete");
          const dialogueRuntime = compileProductionDialogueRuntime({
            plan,
            timeline: input.timeline,
            receipts: synthesized.receipts,
            bindings: props.speakerBindings,
          });
          return {
            dialogueRuntime,
            plan,
            bindings: props.speakerBindings,
            synthesized,
          };
        })(),
      };
    }
    const value = await prepared.value;
    await props.host.installDialogue(
      value.plan.dialogue.length === 0 ? null : value.dialogueRuntime,
    );
    return value;
  };

  return {
    assertCurrent: assertSoundRuntimeCurrent,
    audioAssets: (project, timeline) =>
      audioSources(project, timeline, 48_000).map((source) => source.identity),
    audioSources,
    cacheRetention,
    inspectCurrent,
    prepare,
    runtimeIdentity,
    sourceDigest: (project, timeline, dialogueRuntime) =>
      productionSoundSourceDigest({
        project,
        timeline,
        runtimeIdentity: runtimeIdentity(),
        dialogueRuntime,
      }),
  };
};

/** Own the production's H.264 and Opus resources for one invocation. */
export const createProductionRenderEncoderRuntime = (props: {
  createMp4File: IProductionRenderHost["createMp4File"];
  h264Module: IProductionRenderHost["h264Module"];
  preserveCleanup: (
    failure: { error: unknown } | undefined,
    resources: readonly { resource: string; cleanup: () => unknown }[],
  ) => void;
  productionEncoderIdentity: (fps: number) => unknown;
}): IProductionRenderEncoderRuntime => {
  const { BoxParser } =
    residentRuntimePackage<typeof import("mp4box")>("mp4box").module;
  const { PNG } =
    residentRuntimePackage<typeof import("pngjs")>("pngjs").module;
  const assertCurrentEncoder = (
    plan: IAutoMovieProductionRenderJobPlan,
  ): void => {
    if (
      isDeepStrictEqual(
        props.productionEncoderIdentity(plan.frameFormat.fps),
        plan.runtimeIdentity.encoder,
      ) === false
    )
      throw new Error(
        "The installed production encoder identity changed after render planning. Replan before encoding or finalizing.",
      );
  };
  return {
    assertCurrent: assertCurrentEncoder,
    encodeOpus: async (pcm) => {
      if (pcm.length === 0 || pcm.length % 2 !== 0)
        throw new Error(
          "Opus encoding requires non-empty interleaved stereo PCM.",
        );
      const { createEncoder } = await import("libopus-wasm");
      const encoder = await createEncoder({
        bitrate: 128_000,
        complexity: 10,
        vbr: false,
      });
      const sampleFrames = pcm.length / 2;
      let primingSamples = 0;
      let codedSampleFrames = 0;
      const packets: Array<{
        bytes: Uint8Array<ArrayBuffer>;
        duration: number;
        dts: number;
      }> = [];
      let failure: { error: unknown } | undefined;
      try {
        if (
          encoder.frameSize !== 960 ||
          encoder.channels !== 2 ||
          encoder.sampleRate !== 48_000
        )
          throw new Error(
            "Pinned Opus runtime no longer exposes the required 48 kHz stereo 20 ms profile.",
          );
        primingSamples = encoder.getLookahead();
        if (
          Number.isSafeInteger(primingSamples) === false ||
          primingSamples < 0 ||
          primingSamples >= encoder.frameSize
        )
          throw new Error(
            "Pinned Opus runtime returned an invalid encoder lookahead.",
          );
        codedSampleFrames =
          Math.ceil((sampleFrames + primingSamples) / encoder.frameSize) *
          encoder.frameSize;
        for (let dts = 0; dts < codedSampleFrames; dts += encoder.frameSize) {
          const frame = new Float32Array(encoder.frameSize * encoder.channels);
          frame.set(
            pcm.subarray(
              dts * encoder.channels,
              Math.min(
                pcm.length,
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
      } catch (error) {
        failure = { error };
      }
      props.preserveCleanup(failure, [
        { resource: "Opus encoder", cleanup: (): void => encoder.free() },
      ]);
      const description = new BoxParser.box.dOps();
      description.Version = 0;
      description.OutputChannelCount = 2;
      description.PreSkip = primingSamples;
      description.InputSampleRate = 48_000;
      description.OutputGain = 0;
      description.ChannelMappingFamily = 0;
      description.StreamCount = 1;
      description.CoupledCount = 1;
      description.ChannelMapping = [];
      const file = props.createMp4File();
      file.init({
        brands: ["isom", "iso2", "mp41", "Opus"],
        timescale: 48_000,
        duration: codedSampleFrames,
      });
      const track = file.addTrack({
        type: "Opus",
        hdlr: "soun",
        name: "AutoMovie deterministic Opus mix",
        timescale: 48_000,
        media_duration: codedSampleFrames,
        duration: codedSampleFrames,
        samplerate: 48_000,
        channel_count: 2,
        samplesize: 16,
        description_boxes: [description],
      });
      for (const packet of packets)
        file.addSample(track, packet.bytes, {
          duration: packet.duration,
          dts: packet.dts,
          cts: packet.dts,
          is_sync: true,
        });
      trimProductionAudioPresentation({
        file,
        track,
        mediaTimescale: 48_000,
        movieTimescale: 48_000,
        primingSamples,
        presentationSamples: sampleFrames,
      });
      return new Uint8Array(file.getBuffer().buffer);
    },
    encodePngFrames: async (produceFrames, plan) => {
      assertCurrentEncoder(plan);
      const module = props.h264Module;
      const createEncoder =
        typeof module.createH264MP4Encoder === "function"
          ? module.createH264MP4Encoder
          : module.default?.createH264MP4Encoder;
      if (createEncoder === undefined)
        throw new Error(
          "The installed h264-mp4-encoder package exposes no createH264MP4Encoder factory. Reinstall the pinned encoder before rendering.",
        );
      const encoder = await createEncoder();
      let initialized = false;
      let finalizeAttempted = false;
      let failure: { error: unknown } | undefined;
      let output = new Uint8Array();
      try {
        encoder.width = plan.frameFormat.width;
        encoder.height = plan.frameFormat.height;
        encoder.frameRate = plan.frameFormat.fps;
        encoder.quantizationParameter =
          plan.runtimeIdentity.encoder.arguments.quantizationParameter;
        encoder.speed = plan.runtimeIdentity.encoder.arguments.speed;
        encoder.groupOfPictures =
          plan.runtimeIdentity.encoder.arguments.groupOfPictures;
        encoder.initialize();
        initialized = true;
        await produceFrames((frame) => {
          const png = PNG.sync.read(Buffer.from(frame));
          encoder.addFrameRgba(new Uint8Array(png.data));
        });
        finalizeAttempted = true;
        encoder.finalize();
        output = Uint8Array.from(encoder.FS.readFile(encoder.outputFilename));
      } catch (error) {
        failure = { error };
      }
      props.preserveCleanup(failure, [
        ...(initialized && finalizeAttempted === false
          ? [
              {
                resource: "H.264 encoder finalizer",
                cleanup: (): void => {
                  finalizeAttempted = true;
                  encoder.finalize();
                },
              },
            ]
          : []),
        { resource: "H.264 encoder", cleanup: (): void => encoder.delete() },
      ]);
      return output;
    },
  };
};

/** Plan, mix, inspect, and encode one compiler-owned production soundtrack. */
export const produceProductionSound = async (props: {
  assertCurrent: () => void;
  assertRenderClock: (input: {
    plan: IAutoMovieProductionSoundPlan;
    render: IAutoMovieProductionRenderJobPlan;
  }) => void;
  audioSources: (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
    sampleRate: number,
  ) => Array<{
    identity: { path: string };
    samples: Float32Array | null;
  }>;
  encoder: IProductionRenderEncoderRuntime;
  prepare: (input: {
    project: AutoMovieProductionProject;
    compileFingerprint: AutoMovieContentDigest;
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
  }) => Promise<IPreparedProductionSoundRuntime>;
  progress: (
    stage: string,
    details?: Readonly<Record<string, number | string>>,
  ) => void;
  project: AutoMovieProductionProject;
  renderPlan: IAutoMovieProductionRenderJobPlan;
}): Promise<IProductionSoundBundle> => {
  const timeline = readAutoMovieFilmTimeline(
    props.project,
    props.renderPlan.compileFingerprint,
  );
  const prepared = await props.prepare({
    project: props.project,
    compileFingerprint: props.renderPlan.compileFingerprint,
    timeline,
  });
  const soundPlan = prepared.plan;
  props.assertRenderClock({ plan: soundPlan, render: props.renderPlan });
  props.progress("sound.assets.decode.start");
  const assets = new Map(
    props
      .audioSources(props.project, timeline, soundPlan.sampleRate)
      .flatMap((source) =>
        source.samples === null
          ? []
          : [[source.identity.path, source.samples] as const],
      ),
  );
  props.progress("sound.assets.decode.complete", { decoded: assets.size });
  const synthesized = prepared.synthesized;
  props.progress("sound.render.start");
  const rendered = renderProductionSound({
    plan: soundPlan,
    dialogue: synthesized.pcm,
    assets,
  });
  props.progress("sound.render.complete");
  if (
    rendered.analysis.clippingSamples !== 0 ||
    rendered.analysis.eventAlignment.some((event) => event.passed === false)
  )
    throw new Error(
      "Final sound failed clipping or semantic event/frame alignment gates.",
    );
  props.progress("sound.evidence.render.start");
  const waveform = productionSoundWaveform(rendered.pcm);
  const spectrogram = productionSoundSpectrogram(rendered.pcm);
  props.progress("sound.evidence.render.complete");
  props.progress("sound.opus.encode.start");
  const audio = await runWithProductionRuntimeClosure(props.assertCurrent, () =>
    props.encoder.encodeOpus(rendered.pcm),
  );
  props.progress("sound.opus.encode.complete");
  props.progress("sound.evidence.encode.start");
  const [waveformBytes, spectrogramBytes] =
    await runWithProductionRuntimeClosure(props.assertCurrent, () => [
      encodeProductionSoundRaster(waveform),
      encodeProductionSoundRaster(spectrogram),
    ]);
  props.progress("sound.evidence.encode.complete");
  return {
    plan: soundPlan,
    analysis: rendered.analysis,
    tts: synthesized.receipts,
    audio,
    waveform: waveformBytes,
    spectrogram: spectrogramBytes,
  };
};

export const encodeProductionSoundRaster = (raster: {
  width: number;
  height: number;
  rgba: Uint8Array;
}): Uint8Array => {
  const { PNG } =
    residentRuntimePackage<typeof import("pngjs")>("pngjs").module;
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.rgba);
  return PNG.sync.write(png);
};

export const concatenateProductionFloat32 = (
  chunks: readonly Float32Array[],
): Float32Array => {
  const output = new Float32Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};
