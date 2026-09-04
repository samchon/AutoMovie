import type {
  AutoMovieContentDigest,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import {
  assertAutoMovieExternalGeneratorTermsAt,
  digestAutoMovieBytes,
} from "@automovie/production";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { IDialogueCacheSnapshot } from "./dialogueCacheSnapshot";
import type { IAutoMovieDialogueSynthesisSelection } from "./productionConfiguration";

/** Current private cache protocol. A lossy v5 generation is never relabelled. */
export const PRODUCTION_DIALOGUE_CACHE_VERSION = 6 as const;

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
    value = JSON.parse(Buffer.from(props.snapshot.receipt).toString("utf8"));
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
