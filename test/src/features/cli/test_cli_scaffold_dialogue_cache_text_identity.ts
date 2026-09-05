import { digestAutoMovieBytes } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

import { rejectsError } from "../internal/predicates";

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

interface ISelection {
  provider: string;
  model: string;
  modelRevision: string;
  dtype: string;
  device: string;
  voice: string;
  speed: number;
  generatorProvenance: IProvenance;
}

const selection: ISelection = {
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
};
const runtimeAssets = [
  { path: "package:kokoro-js", digest: `sha256:${"1".repeat(64)}` },
] as Array<{ path: string; digest: `sha256:${string}` }>;
const pcm = new Uint8Array(Float32Array.of(0.25, -0).buffer);

interface IDialogueCacheModule {
  PRODUCTION_DIALOGUE_CACHE_VERSION: 6;
  productionDialogueCacheIdentity(props: {
    cacheRoot: string;
    selection: ISelection;
    text: string;
    language: string;
    speaker: string | null;
    runtimeAssets: typeof runtimeAssets;
  }): IIdentity;
  validateProductionDialogueCache(props: {
    identity: IIdentity;
    runtimeAssets: typeof runtimeAssets;
    selection: ISelection;
    snapshot: { pcm: Uint8Array; receipt: Uint8Array };
  }): { status: string };
  inspectProductionDialogueCache(props: {
    identity: IIdentity;
    runtimeAssets: typeof runtimeAssets;
    selection: ISelection;
    read: () => unknown;
  }): { status: string; error?: unknown };
  generateProductionDialogueCache(props: {
    line: string;
    identity: IIdentity;
    selection: ISelection;
    runtimeAssets: typeof runtimeAssets;
    generatedAt: string;
    synthesize: (request: IGenerationRequest) => Promise<IGenerationChunk[]>;
  }): Promise<{
    record: IProductionDialogueCacheRecord;
    pcm: Uint8Array;
    receipt: Uint8Array;
  }>;
  projectProductionDialogueReceipt(props: {
    line: { id: string; startFrame: number; endFrame: number };
    cached: { record: IProductionDialogueCacheRecord; samples: Float32Array };
  }): Record<string, unknown> & {
    version: number;
    line: string;
    cacheKey: string;
    phonemes: string;
    visemes: Array<{
      phoneme: string;
      viseme: string;
      startFrame: number;
      endFrame: number;
    }>;
  };
}

interface IGenerationRequest {
  text: string;
  voice: string;
  speed: number;
}

interface IGenerationChunk {
  audio: ArrayLike<number>;
  phonemes: string;
  sampleRate: number;
}

const cacheModule = createRequire(__filename)(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/dialogueCacheTextIdentity.ts",
  ),
) as IDialogueCacheModule;
const {
  PRODUCTION_DIALOGUE_CACHE_VERSION,
  generateProductionDialogueCache,
  inspectProductionDialogueCache,
  productionDialogueCacheIdentity,
  projectProductionDialogueReceipt,
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

/**
 * The dialogue cache binds one exact request text to one generation.
 *
 * The private v5 key hashed the line after NFKC normalization while the miss
 * path handed the raw line to Kokoro, so `"Ⅳ"` and `"IV"` shared a key and the
 * second run reused the first run's PCM, phonemes, and visemes as current. The
 * v6 protocol keys the exact scalar sequence, seals that same string into the
 * record, executes only that string, and validates request text, phoneme
 * coherence, PCM identity, and runtime closure as one value before any cached
 * sample is exposed. Observation failures keep their category rather than
 * collapsing into a cache miss.
 *
 * The scaffold module is loaded directly and every collaborator is injected:
 * no generated project, model, filesystem cache, or worker takes part.
 *
 * Scenarios:
 *
 * 1. Compatibility-equivalent pairs (`Ⅳ`/`IV`, precomposed and decomposed
 *    `Café`, fullwidth and ASCII `A`) keep their exact request text and get
 *    distinct keys, and a four-byte scalar survives unchanged.
 * 2. An exact v6 record with a coherent phoneme carrier validates as current; a
 *    v5 record is stale, never relabelled; a record paired with another exact
 *    request is stale; a changed aggregate, reordered chunks, a broken sample
 *    range, or a wrong PCM digest each fail integrity; empty and whitespace
 *    chunk phonemes remain one coherent carrier; non-finite cached PCM fails
 *    before exposure.
 * 3. Inspection classifies genuine absence without an error, keeps an exact
 *    current generation current beside an invalid sibling, reports a stale
 *    record at the current target as an integrity failure rather than a miss,
 *    and preserves the category and original cause of unavailable, unsafe,
 *    integrity, and unknown observation failures.
 * 4. Generation hands the synthesizer exactly the request text the key was
 *    computed from, seals that text and the ordered chunks into the record,
 *    and the sealed bytes validate as current; an invalid or changing sample
 *    rate, an empty or non-finite chunk, an empty stream, a terms date after
 *    the generation instant, and a generation instant the record cannot
 *    reproduce are each refused by line before publication.
 * 5. The public receipt is projected from the validated record's single
 *    phoneme carrier onto each line's own placement, so the same generation
 *    serves two lines with different ids and frames while the private request
 *    text stays out of the receipt.
 */
export const test_cli_scaffold_dialogue_cache_text_identity =
  async (): Promise<void> => {
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

    // Generation: the synthesizer is a sink that records what it was asked to
    // say, and the record is checked against that observation rather than
    // against the code's own idea of the request.
    const requests: IGenerationRequest[] = [];
    const stream: IGenerationChunk[] = [
      { audio: [0.25, -0.5], phonemes: "kæ", sampleRate: 24_000 },
      { audio: Float32Array.of(0.125), phonemes: "f", sampleRate: 24_000 },
    ];
    const generate = (props: {
      text?: string;
      chunks?: IGenerationChunk[];
      generatedAt?: string;
      termsCheckedAt?: string;
    }) => {
      const text = props.text ?? "Café";
      const generationSelection = {
        ...selection,
        generatorProvenance: {
          ...selection.generatorProvenance,
          termsCheckedAt:
            props.termsCheckedAt ??
            selection.generatorProvenance.termsCheckedAt,
        },
      };
      return generateProductionDialogueCache({
        line: "line-a",
        identity: productionDialogueCacheIdentity({
          cacheRoot: "state/audio-cache/kokoro",
          selection: generationSelection,
          text,
          language: "en",
          speaker: null,
          runtimeAssets,
        }),
        selection: generationSelection,
        runtimeAssets,
        generatedAt: props.generatedAt ?? "2025-01-02T00:00:00.000Z",
        synthesize: async (request) => {
          requests.push(request);
          return props.chunks ?? stream;
        },
      });
    };
    const generated = await generate({});
    const expectedPcm = new Uint8Array(
      Float32Array.of(0.25, -0.5, 0.125).buffer,
    );
    TestValidator.equals(
      "the executed request, the sealed record, and the key share one exact text",
      {
        requests,
        requestText: generated.record.requestText,
        cacheKey: generated.record.cacheKey,
        phonemes: generated.record.phonemes,
        phonemeChunks: generated.record.phonemeChunks,
        sourceSampleRate: generated.record.sourceSampleRate,
        sourceSamples: generated.record.sourceSamples,
        pcm: Buffer.from(generated.pcm).equals(expectedPcm),
        pcmDigest: generated.record.pcmDigest,
        receipt: JSON.parse(Buffer.from(generated.receipt).toString("utf8")),
        sealedIsCurrent: validateProductionDialogueCache({
          identity: identity("Café"),
          runtimeAssets,
          selection,
          snapshot: { pcm: generated.pcm, receipt: generated.receipt },
        }).status,
      },
      {
        requests: [
          { text: "Café", voice: selection.voice, speed: selection.speed },
        ],
        requestText: "Café",
        cacheKey: identity("Café").key,
        phonemes: "kæf",
        phonemeChunks: [
          { phonemes: "kæ", startSample: 0, endSample: 2 },
          { phonemes: "f", startSample: 2, endSample: 3 },
        ],
        sourceSampleRate: 24_000,
        sourceSamples: 3,
        pcm: true,
        pcmDigest: digestAutoMovieBytes(expectedPcm),
        receipt: generated.record,
        sealedIsCurrent: "current",
      },
    );
    const oneChunk = (chunk: IGenerationChunk): IGenerationChunk[] => [chunk];
    const refusals: Array<
      [string, Parameters<typeof generate>[0], readonly string[]]
    > = [
      [
        "an invalid sample rate",
        { chunks: oneChunk({ audio: [0.1], phonemes: "a", sampleRate: 0 }) },
        ['line "line-a"', "invalid PCM sample rate"],
      ],
      [
        "a sample rate that changes mid-stream",
        {
          chunks: [
            { audio: [0.1], phonemes: "a", sampleRate: 24_000 },
            { audio: [0.1], phonemes: "b", sampleRate: 22_050 },
          ],
        },
        ['line "line-a"', "changed PCM sample rate mid-stream"],
      ],
      [
        "an empty chunk",
        { chunks: oneChunk({ audio: [], phonemes: "a", sampleRate: 24_000 }) },
        ['line "line-a"', "empty PCM chunk"],
      ],
      [
        "a non-finite sample at its source index",
        {
          chunks: [
            { audio: [0.1, 0.2], phonemes: "a", sampleRate: 24_000 },
            { audio: [0.3, Number.NaN], phonemes: "b", sampleRate: 24_000 },
          ],
        },
        ['line "line-a"', "non-finite PCM sample at source index 3"],
      ],
      [
        "an empty stream",
        { chunks: [] },
        ['synthesized no PCM for line "line-a"'],
      ],
      [
        "a terms review dated after the generation instant",
        { termsCheckedAt: "2025-01-03" },
        ["Kokoro dialogue generation generatorProvenance"],
      ],
      [
        "a generation instant the record cannot reproduce",
        { generatedAt: "2025-01-02" },
        [
          'line "line-a"',
          "failed cache protocol validation before publication: receipt-coherence",
        ],
      ],
    ];
    for (const [name, props, fragments] of refusals)
      TestValidator.predicate(
        `${name} is refused before publication`,
        await rejectsError(() => generate(props), fragments),
      );

    // Projection: one validated generation, two lines. Frame ranges are the
    // proportional placement of each chunk's sample range on the line's frames:
    // "k" owns source sample 0 of 2 and lands on the line's first frame, "æf"
    // owns sample 1 of 2 and lands on its second.
    const cached = {
      record: record("read me"),
      samples: Float32Array.of(0.25, -0),
    };
    const receiptA = projectProductionDialogueReceipt({
      line: { id: "a", startFrame: 10, endFrame: 12 },
      cached,
    });
    const receiptB = projectProductionDialogueReceipt({
      line: { id: "b", startFrame: 20, endFrame: 22 },
      cached,
    });
    TestValidator.equals(
      "one generation is projected onto each line's own placement",
      {
        lines: [receiptA.line, receiptB.line],
        versions: [receiptA.version, receiptB.version],
        sameKey: receiptA.cacheKey === receiptB.cacheKey,
        key: receiptA.cacheKey,
        phonemes: receiptA.phonemes,
        privateTextExposed:
          "requestText" in receiptA || "requestText" in receiptB,
        visemesA: receiptA.visemes,
        visemesB: receiptB.visemes,
      },
      {
        lines: ["a", "b"],
        versions: [6, 6],
        sameKey: true,
        key: identity("read me").key,
        phonemes: "kæf",
        privateTextExposed: false,
        visemesA: [
          { phoneme: "k", viseme: "rest", startFrame: 10, endFrame: 11 },
          { phoneme: "æf", viseme: "aa", startFrame: 11, endFrame: 12 },
        ],
        visemesB: [
          { phoneme: "k", viseme: "rest", startFrame: 20, endFrame: 21 },
          { phoneme: "æf", viseme: "aa", startFrame: 21, endFrame: 22 },
        ],
      },
    );
  };
