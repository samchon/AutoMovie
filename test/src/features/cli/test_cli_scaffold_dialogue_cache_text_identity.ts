import { digestAutoMovieBytes } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

interface IIdentity {
  requestText: string;
  key: `sha256:${string}`;
  path: string;
}

interface IProvenance {
  source: string;
  license: string;
  termsCheckedAt: string;
  cost: string;
  consumer: { kind: "dialogue-synthesis"; reason: string };
}

interface IProductionDialogueCacheRecord {
  version: 6;
  requestText: string;
  cacheKey: `sha256:${string}`;
  model: string;
  modelRevision: string;
  voice: string;
  generatorProvenance: IProvenance;
  generatedAt: string;
  sourceSampleRate: number;
  sourceSamples: number;
  pcmDigest: `sha256:${string}`;
  phonemes: string;
  phonemeChunks: Array<{
    phonemes: string;
    startSample: number;
    endSample: number;
  }>;
  runtimeAssets: Array<{ path: string; digest: `sha256:${string}` }>;
}

const selection = {
  provider: "kokoro-local-v1",
  model: "onnx-community/Kokoro-82M-v1.0-ONNX",
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
  dtype: "q8",
  device: "cpu",
  voice: "af_heart",
  speed: 1,
  generatorProvenance: {
    source: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX",
    license: "Apache-2.0",
    termsCheckedAt: "2025-01-01",
    cost: "local compute",
    consumer: { kind: "dialogue-synthesis", reason: "fixture dialogue" },
  },
} as const;
const runtimeAssets = [
  { path: "package:kokoro-js", digest: `sha256:${"1".repeat(64)}` },
] as Array<{ path: string; digest: `sha256:${string}` }>;
const pcm = new Uint8Array(Float32Array.of(0.25, -0).buffer);

interface IDialogueCacheModule {
  PRODUCTION_DIALOGUE_CACHE_VERSION: 6;
  productionDialogueCacheIdentity(props: {
    cacheRoot: string;
    selection: typeof selection;
    text: string;
    language: string;
    speaker: string | null;
    runtimeAssets: typeof runtimeAssets;
  }): IIdentity;
  validateProductionDialogueCache(props: {
    identity: IIdentity;
    runtimeAssets: typeof runtimeAssets;
    selection: typeof selection;
    snapshot: { pcm: Uint8Array; receipt: Uint8Array };
  }): { status: string };
  inspectProductionDialogueCache(props: {
    identity: IIdentity;
    runtimeAssets: typeof runtimeAssets;
    selection: typeof selection;
    read: () => unknown;
  }): { status: string; error?: unknown };
}

const cacheModule = createRequire(__filename)(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/dialogueCacheTextIdentity.ts",
  ),
) as IDialogueCacheModule;
const {
  PRODUCTION_DIALOGUE_CACHE_VERSION,
  inspectProductionDialogueCache,
  productionDialogueCacheIdentity,
  validateProductionDialogueCache,
} = cacheModule;

const identity = (text: string) =>
  productionDialogueCacheIdentity({
    cacheRoot: "state/audio-cache/kokoro",
    selection,
    text,
    language: "en",
    speaker: null,
    runtimeAssets,
  });

const record = (
  text: string,
  overrides: Partial<IProductionDialogueCacheRecord> = {},
): IProductionDialogueCacheRecord => {
  const request = identity(text);
  return {
    version: PRODUCTION_DIALOGUE_CACHE_VERSION,
    requestText: request.requestText,
    cacheKey: request.key,
    model: selection.model,
    modelRevision: selection.modelRevision,
    voice: selection.voice,
    generatorProvenance: selection.generatorProvenance,
    generatedAt: "2025-01-02T00:00:00.000Z",
    sourceSampleRate: 24_000,
    sourceSamples: 2,
    pcmDigest: digestAutoMovieBytes(pcm),
    phonemes: "kæf",
    phonemeChunks: [
      { phonemes: "k", startSample: 0, endSample: 1 },
      { phonemes: "æf", startSample: 1, endSample: 2 },
    ],
    runtimeAssets,
    ...overrides,
  };
};

const validation = (
  text: string,
  value: IProductionDialogueCacheRecord,
  bytes: Uint8Array = pcm,
) =>
  validateProductionDialogueCache({
    identity: identity(text),
    runtimeAssets,
    selection,
    snapshot: {
      pcm: bytes,
      receipt: Buffer.from(JSON.stringify(value), "utf8"),
    },
  });

/** Exact request text, private migration, and phoneme coherence share one seam. */
export const test_cli_scaffold_dialogue_cache_text_identity = (): void => {
  const pairs = [
    ["Ⅳ", "IV"],
    ["Café", "Cafe\u0301"],
    ["Ａ", "A"],
  ] as const;
  for (const [left, right] of pairs)
    TestValidator.equals(
      `exact requests stay distinct: ${left}/${right}`,
      {
        text: identity(left).requestText === left,
        different: identity(left).key !== identity(right).key,
      },
      { text: true, different: true },
    );
  const nonBmp = "𐀀";
  TestValidator.equals(
    "a four-byte scalar is retained exactly",
    identity(nonBmp).requestText,
    nonBmp,
  );
  TestValidator.equals(
    "the same request remains reusable across line placement",
    identity("same").key,
    identity("same").key,
  );

  const exact = record("Café");
  TestValidator.equals(
    "an exact v6 request and coherent phoneme carrier are current",
    validation("Café", exact).status,
    "current",
  );
  TestValidator.equals(
    "v5 is stale rather than relabelled",
    validation("Café", {
      ...exact,
      version: 5,
      requestText: undefined,
    } as never).status,
    "stale",
  );
  TestValidator.equals(
    "a record cannot impersonate another exact request",
    validation("Cafe\u0301", exact).status,
    "stale",
  );
  const contradictions: Array<
    [string, Partial<IProductionDialogueCacheRecord>]
  > = [
    ["aggregate", { phonemes: "different" }],
    [
      "chunk-order",
      {
        phonemeChunks: [
          { phonemes: "æf", startSample: 0, endSample: 1 },
          { phonemes: "k", startSample: 1, endSample: 2 },
        ],
      },
    ],
    [
      "range",
      {
        phonemeChunks: [
          { phonemes: "k", startSample: 0, endSample: 1 },
          { phonemes: "æf", startSample: 0, endSample: 2 },
        ],
      },
    ],
    ["digest", { pcmDigest: `sha256:${"2".repeat(64)}` }],
  ];
  for (const [name, changed] of contradictions)
    TestValidator.equals(
      `${name} contradiction fails integrity`,
      validation("Café", { ...exact, ...changed }).status,
      "integrity-failed",
    );
  TestValidator.equals(
    "empty and whitespace chunk phonemes remain one coherent carrier",
    validation(
      "Café",
      record("Café", {
        phonemes: " ",
        phonemeChunks: [
          { phonemes: "", startSample: 0, endSample: 1 },
          { phonemes: " ", startSample: 1, endSample: 2 },
        ],
      }),
    ).status,
    "current",
  );
  TestValidator.equals(
    "non-finite cached PCM fails before exposure",
    validation(
      "Café",
      record("Café", {
        pcmDigest: digestAutoMovieBytes(
          new Uint8Array(Float32Array.of(Number.NaN, 0).buffer),
        ),
      }),
      new Uint8Array(Float32Array.of(Number.NaN, 0).buffer),
    ).status,
    "integrity-failed",
  );

  const request = identity("read me");
  TestValidator.equals(
    "genuine absence is classified without an error",
    inspectProductionDialogueCache({
      identity: request,
      runtimeAssets,
      selection,
      read: () => null,
    }).status,
    "absent",
  );
  const currentSnapshot = {
    pcm,
    receipt: Buffer.from(JSON.stringify(record("read me")), "utf8"),
    snapshot: {},
  };
  TestValidator.equals(
    "one invalid sibling does not erase an exact current generation",
    [
      inspectProductionDialogueCache({
        identity: request,
        runtimeAssets,
        selection,
        read: () => currentSnapshot,
      }).status,
      inspectProductionDialogueCache({
        identity: identity("other"),
        runtimeAssets,
        selection,
        read: () => ({
          ...currentSnapshot,
          receipt: Buffer.from("not json", "utf8"),
        }),
      }).status,
    ],
    ["current", "integrity-failed"],
  );
  TestValidator.equals(
    "a stale record at the current target is an integrity failure, not a cache miss",
    inspectProductionDialogueCache({
      identity: identity("other"),
      runtimeAssets,
      selection,
      read: () => currentSnapshot,
    }).status,
    "integrity-failed",
  );
  for (const [status, failure] of [
    [
      "unavailable",
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    ],
    [
      "unsafe-locator-or-foreign-generation",
      new Error("symbolic link escaped cache ownership"),
    ],
    [
      "unsafe-locator-or-foreign-generation",
      Object.assign(new Error("too many symbolic links"), { code: "ELOOP" }),
    ],
    [
      "unsafe-locator-or-foreign-generation",
      new Error("Render GC content changed while read."),
    ],
    ["integrity-failed", new Error("invalid exact inventory")],
    ["integrity-failed", new Error("receipt exceeds its read boundary")],
    ["unavailable", Object.assign(new Error("I/O failure"), { code: "EIO" })],
    ["unknown-observation", new Error("unexpected observer failure")],
  ] as const) {
    const finding = inspectProductionDialogueCache({
      identity: request,
      runtimeAssets,
      selection,
      read: () => {
        throw failure;
      },
    });
    TestValidator.equals(
      `${status} observation keeps its category and original cause`,
      {
        status: finding.status,
        cause: finding.error,
      },
      { status, cause: failure },
    );
  }
};
