import { productionPhonemesToVisemes } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import {
  assertAutoMovieExternalGeneratorTermsAt,
  digestAutoMovieBytes,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { IDialogueCacheSnapshot } from "./dialogueCacheSnapshot";
import type { IAutoMovieDialogueSynthesisSelection } from "./productionConfiguration";

/** Current private cache protocol. A lossy v5 generation is never relabelled. */
export const PRODUCTION_DIALOGUE_CACHE_VERSION = 6 as const;

/** One synthesized stream chunk on the generator's own PCM clock. */
export interface IProductionDialogueGenerationChunk {
  audio: ArrayLike<number>;
  phonemes: string;
  sampleRate: number;
}

/** One sealed generation: the private record and the exact bytes it describes. */
export interface IProductionDialogueCacheGeneration {
  record: IProductionDialogueCacheRecord;
  pcm: Uint8Array;
  receipt: Uint8Array;
}

export interface IProductionDialogueCacheIdentity {
  requestText: string;
  key: AutoMovieContentDigest;
  path: string;
}

export interface IProductionDialogueCacheRecord {
  version: typeof PRODUCTION_DIALOGUE_CACHE_VERSION;
  requestText: string;
  cacheKey: AutoMovieContentDigest;
  model: IAutoMovieDialogueSynthesisSelection["model"];
  modelRevision: IAutoMovieDialogueSynthesisSelection["modelRevision"];
  voice: string;
  generatorProvenance: IAutoMovieDialogueSynthesisSelection["generatorProvenance"];
  generatedAt: string;
  sourceSampleRate: number;
  sourceSamples: number;
  pcmDigest: AutoMovieContentDigest;
  phonemes: string;
  phonemeChunks: IAutoMovieProductionTtsReceipt["phonemeChunks"];
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
}

export interface IValidatedProductionDialogueCache {
  record: IProductionDialogueCacheRecord;
  samples: Float32Array;
}

export type IProductionDialogueCacheFinding =
  | { status: "absent"; identity: IProductionDialogueCacheIdentity }
  | {
      status: "current";
      identity: IProductionDialogueCacheIdentity;
      snapshot: IDialogueCacheSnapshot;
      cached: IValidatedProductionDialogueCache;
    }
  | {
      status: "integrity-failed";
      identity: IProductionDialogueCacheIdentity;
      reason: string;
      error?: unknown;
      snapshot?: IDialogueCacheSnapshot;
    }
  | {
      status:
        | "unsafe-locator-or-foreign-generation"
        | "unavailable"
        | "unknown-observation";
      identity: IProductionDialogueCacheIdentity;
      error: unknown;
    };

/** Bind the exact scalar sequence executed by Kokoro to its private key. */
export const productionDialogueCacheIdentity = (props: {
  cacheRoot: string;
  selection: IAutoMovieDialogueSynthesisSelection;
  text: string;
  language: string;
  speaker: string | null;
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
}): IProductionDialogueCacheIdentity => {
  const requestText = props.text;
  const key = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        version: PRODUCTION_DIALOGUE_CACHE_VERSION,
        ...props.selection,
        requestText,
        language: props.language.normalize("NFKC"),
        speaker: props.speaker?.normalize("NFKC") ?? null,
        runtimeAssets: props.runtimeAssets,
      }),
      "utf8",
    ),
  );
  return { requestText, key, path: path.join(props.cacheRoot, key.slice(7)) };
};

/**
 * Execute one exact request and seal its generation before publication.
 *
 * The synthesizer is handed `identity.requestText` and no other spelling of
 * the line exists past this point: the record's request text, its key, the
 * ordered phoneme chunks, and the joined aggregate all derive from that one
 * identity and one stream, and the sealed bytes are validated exactly as the
 * reader will validate them, so a generation that could not be read back as
 * current is never published.
 */
export const generateProductionDialogueCache = async (props: {
  line: string;
  identity: IProductionDialogueCacheIdentity;
  selection: IAutoMovieDialogueSynthesisSelection;
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  /** ISO-8601 UTC instant captured immediately before the generator call. */
  generatedAt: string;
  synthesize: (request: {
    text: string;
    voice: string;
    speed: number;
  }) => Promise<readonly IProductionDialogueGenerationChunk[]>;
}): Promise<IProductionDialogueCacheGeneration> => {
  assertAutoMovieExternalGeneratorTermsAt({
    termsCheckedAt: props.selection.generatorProvenance.termsCheckedAt,
    occurredAt: props.generatedAt,
    label: "Kokoro dialogue generation generatorProvenance",
  });
  const generated = await props.synthesize({
    text: props.identity.requestText,
    voice: props.selection.voice,
    speed: props.selection.speed,
  });
  const chunks: Float32Array[] = [];
  const phonemeChunks: IProductionDialogueCacheRecord["phonemeChunks"] = [];
  let sourceSampleRate: number | undefined;
  let sourceOffset = 0;
  for (const chunk of generated) {
    if (
      Number.isSafeInteger(chunk.sampleRate) === false ||
      chunk.sampleRate <= 0
    )
      throw new Error(
        `Kokoro line "${props.line}" returned an invalid PCM sample rate.`,
      );
    if (sourceSampleRate !== undefined && sourceSampleRate !== chunk.sampleRate)
      throw new Error(
        `Kokoro line "${props.line}" changed PCM sample rate mid-stream.`,
      );
    sourceSampleRate = chunk.sampleRate;
    const audio = Float32Array.from(chunk.audio);
    if (audio.length === 0)
      throw new Error(
        `Kokoro line "${props.line}" returned an empty PCM chunk.`,
      );
    for (let index = 0; index < audio.length; ++index)
      if (Number.isFinite(audio[index]) === false)
        throw new Error(
          `Kokoro line "${props.line}" returned a non-finite PCM sample at source index ${sourceOffset + index}.`,
        );
    chunks.push(audio);
    phonemeChunks.push({
      phonemes: chunk.phonemes,
      startSample: sourceOffset,
      endSample: sourceOffset + audio.length,
    });
    sourceOffset += audio.length;
  }
  if (sourceSampleRate === undefined)
    throw new Error(`Kokoro synthesized no PCM for line "${props.line}".`);
  const samples = new Float32Array(sourceOffset);
  let written = 0;
  for (const chunk of chunks) {
    samples.set(chunk, written);
    written += chunk.length;
  }
  const pcm = new Uint8Array(samples.buffer);
  const record: IProductionDialogueCacheRecord = {
    version: PRODUCTION_DIALOGUE_CACHE_VERSION,
    requestText: props.identity.requestText,
    cacheKey: props.identity.key,
    model: props.selection.model,
    modelRevision: props.selection.modelRevision,
    voice: props.selection.voice,
    generatorProvenance: props.selection.generatorProvenance,
    generatedAt: props.generatedAt,
    sourceSampleRate,
    sourceSamples: samples.length,
    pcmDigest: digestAutoMovieBytes(pcm),
    phonemes: phonemeChunks.map((chunk) => chunk.phonemes).join(""),
    phonemeChunks,
    runtimeAssets: props.runtimeAssets,
  };
  const receipt = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
  const validation = validateProductionDialogueCache({
    snapshot: { pcm, receipt },
    identity: props.identity,
    runtimeAssets: props.runtimeAssets,
    selection: props.selection,
  });
  if (validation.status !== "current")
    throw new Error(
      `Kokoro generation for line "${props.line}" failed cache protocol validation before publication: ${validation.reason}.`,
    );
  return { record, pcm, receipt };
};

/**
 * Project one validated generation onto a line's placement.
 *
 * The public receipt consumes the validated record's single phoneme carrier
 * and retimes its chunks onto the line's frames; the private request text
 * stays private. The same generation may serve any line that made the same
 * exact request, because line placement is not a synthesis input.
 */
export const projectProductionDialogueReceipt = (props: {
  line: Pick<
    IAutoMovieProductionDialogueLine,
    "id" | "startFrame" | "endFrame"
  >;
  cached: IValidatedProductionDialogueCache;
}): IAutoMovieProductionTtsReceipt => {
  const { requestText: _requestText, ...record } = props.cached.record;
  return {
    ...record,
    version: 6,
    line: props.line.id,
    visemes: productionPhonemesToVisemes({
      chunks: record.phonemeChunks,
      sourceSamples: record.sourceSamples,
      startFrame: props.line.startFrame,
      endFrame: props.line.endFrame,
    }),
  };
};

/** Capture and classify one target without turning observation failure into absence. */
export const inspectProductionDialogueCache = (props: {
  identity: IProductionDialogueCacheIdentity;
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  selection: IAutoMovieDialogueSynthesisSelection;
  read: () => IDialogueCacheSnapshot | null;
}): IProductionDialogueCacheFinding => {
  let snapshot: IDialogueCacheSnapshot | null;
  try {
    snapshot = props.read();
  } catch (error) {
    const status = classifyProductionDialogueCacheObservation(error);
    if (status === "integrity-failed")
      return {
        status,
        identity: props.identity,
        reason: "physical-cache-generation",
        error,
      };
    return {
      status,
      identity: props.identity,
      error,
    };
  }
  if (snapshot === null) return { status: "absent", identity: props.identity };
  const validated = validateProductionDialogueCache({
    identity: props.identity,
    runtimeAssets: props.runtimeAssets,
    selection: props.selection,
    snapshot,
  });
  if (validated.status === "stale")
    return {
      status: "integrity-failed",
      identity: props.identity,
      reason: `current-target-${validated.reason}`,
      snapshot,
    };
  return { ...validated, identity: props.identity, snapshot };
};

/** Map capture failures without claiming that an unrecognized error is a miss. */
export const classifyProductionDialogueCacheObservation = (
  error: unknown,
):
  | "integrity-failed"
  | "unsafe-locator-or-foreign-generation"
  | "unavailable"
  | "unknown-observation" => {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code !== undefined && UNAVAILABLE_OBSERVATION_CODES.has(code))
    return "unavailable";
  if (code === "ELOOP") return "unsafe-locator-or-foreign-generation";
  const message = error instanceof Error ? error.message : "";
  if (
    /symbolic|junction|reparse|linked|foreign|outside|escapes|ownership|physical|changed|different file|differs from its captured bytes/i.test(
      message,
    )
  )
    return "unsafe-locator-or-foreign-generation";
  if (
    /inventory|receipt|pcm|digest|byte length|read boundary|not a .*directory/i.test(
      message,
    )
  )
    return "integrity-failed";
  return "unknown-observation";
};

const UNAVAILABLE_OBSERVATION_CODES = new Set([
  "EACCES",
  "EPERM",
  "EBUSY",
  "EMFILE",
  "ENFILE",
  "EIO",
  "ENOMEM",
]);

/** Validate request, phoneme, PCM, producer, and runtime closure as one value. */
export const validateProductionDialogueCache = (props: {
  identity: IProductionDialogueCacheIdentity;
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  selection: IAutoMovieDialogueSynthesisSelection;
  snapshot: Pick<IDialogueCacheSnapshot, "pcm" | "receipt">;
}):
  | { status: "current"; cached: IValidatedProductionDialogueCache }
  | { status: "stale"; reason: string }
  | { status: "integrity-failed"; reason: string } => {
  let value: unknown;
  try {
    value = parseAutoMovieStructuredJson({
      record: "dialogue-cache-receipt",
      bytes: props.snapshot.receipt,
    });
  } catch {
    return { status: "integrity-failed", reason: "receipt-json" };
  }
  if (typeof value !== "object" || value === null)
    return { status: "integrity-failed", reason: "receipt-shape" };
  const record = value as Partial<IProductionDialogueCacheRecord>;
  if (typeof record.version !== "number")
    return { status: "integrity-failed", reason: "identity-shape" };
  if (record.version !== PRODUCTION_DIALOGUE_CACHE_VERSION)
    return { status: "stale", reason: "cache-version" };
  if (
    typeof record.cacheKey !== "string" ||
    typeof record.requestText !== "string"
  )
    return { status: "integrity-failed", reason: "identity-shape" };
  if (
    record.cacheKey !== props.identity.key ||
    record.requestText !== props.identity.requestText ||
    record.model !== props.selection.model ||
    record.modelRevision !== props.selection.modelRevision ||
    record.voice !== props.selection.voice ||
    isDeepStrictEqual(
      record.generatorProvenance,
      props.selection.generatorProvenance,
    ) === false ||
    isDeepStrictEqual(record.runtimeAssets, props.runtimeAssets) === false
  )
    return { status: "stale", reason: "request-or-runtime-identity" };
  const generatedAt = new Date(record.generatedAt!);
  const chunks = record.phonemeChunks;
  if (
    typeof record.generatedAt !== "string" ||
    Number.isNaN(generatedAt.getTime()) ||
    generatedAt.toISOString() !== record.generatedAt ||
    Number.isSafeInteger(record.sourceSampleRate) === false ||
    record.sourceSampleRate! <= 0 ||
    Number.isSafeInteger(record.sourceSamples) === false ||
    record.sourceSamples! <= 0 ||
    typeof record.phonemes !== "string" ||
    validPhonemeChunks(chunks, record.sourceSamples!) === false ||
    record.phonemes !== chunks.map((chunk) => chunk.phonemes).join("") ||
    record.sourceSamples! * Float32Array.BYTES_PER_ELEMENT !==
      props.snapshot.pcm.length ||
    record.pcmDigest !== digestAutoMovieBytes(props.snapshot.pcm)
  )
    return { status: "integrity-failed", reason: "receipt-coherence" };
  try {
    assertAutoMovieExternalGeneratorTermsAt({
      termsCheckedAt: record.generatorProvenance!.termsCheckedAt,
      occurredAt: generatedAt,
      label: "Kokoro dialogue receipt generatorProvenance",
    });
  } catch {
    return { status: "integrity-failed", reason: "generator-provenance" };
  }
  const samples = new Float32Array(Uint8Array.from(props.snapshot.pcm).buffer);
  for (let index = 0; index < samples.length; ++index)
    if (Number.isFinite(samples[index]) === false)
      return { status: "integrity-failed", reason: "non-finite-pcm" };
  return {
    status: "current",
    cached: { record: record as IProductionDialogueCacheRecord, samples },
  };
};

const validPhonemeChunks = (
  chunks: unknown,
  sourceSamples: number,
): chunks is IProductionDialogueCacheRecord["phonemeChunks"] =>
  Array.isArray(chunks) &&
  chunks.length > 0 &&
  chunks.every(
    (chunk, index) =>
      typeof chunk === "object" &&
      chunk !== null &&
      typeof chunk.phonemes === "string" &&
      Number.isSafeInteger(chunk.startSample) &&
      Number.isSafeInteger(chunk.endSample) &&
      chunk.startSample === (index === 0 ? 0 : chunks[index - 1]!.endSample) &&
      chunk.endSample > chunk.startSample,
  ) &&
  chunks.at(-1)!.endSample === sourceSamples;
