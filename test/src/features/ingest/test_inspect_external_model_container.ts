import { inspectAutoMovieExternalModelBytes } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/** The smallest document the inspector accepts once a container decodes. */
const document = (): object => ({
  asset: { version: "2.0" },
  nodes: [{ name: "root" }],
});

/** Build a GLB around one JSON chunk, with every header field addressable. */
const container = (props: {
  binChunks?: readonly { length: number; type: number }[];
  declaredLength?: number;
  jsonChunkType?: number;
  jsonLength?: number;
  magic?: number;
  /** Bytes after the last chunk, counted in the declared length. */
  trailingBytes?: number;
  version?: number;
}): Buffer => {
  const source = Buffer.from(JSON.stringify(document()), "utf8");
  const json = Buffer.concat([
    source,
    Buffer.alloc(4 - (source.length % 4), 0x20),
  ]);
  const trailing = (props.binChunks ?? []).reduce(
    (total, chunk) => total + 8 + chunk.length,
    0,
  );
  const output = Buffer.alloc(
    20 + json.length + trailing + (props.trailingBytes ?? 0),
  );
  output.writeUInt32LE(props.magic ?? 0x46546c67, 0);
  output.writeUInt32LE(props.version ?? 2, 4);
  output.writeUInt32LE(props.declaredLength ?? output.length, 8);
  output.writeUInt32LE(props.jsonLength ?? json.length, 12);
  output.writeUInt32LE(props.jsonChunkType ?? 0x4e4f534a, 16);
  json.copy(output, 20);
  let cursor = 20 + json.length;
  for (const chunk of props.binChunks ?? []) {
    output.writeUInt32LE(chunk.length, cursor);
    output.writeUInt32LE(chunk.type, cursor + 4);
    cursor += 8 + chunk.length;
  }
  return output;
};

const inspect = (bytes: Uint8Array, path = "public/models/actor.glb"): void => {
  inspectAutoMovieExternalModelBytes({
    path,
    bytes,
    profile: "gltf-static-v1",
  });
};

/**
 * Every way a GLB container is refused before its glTF is ever read.
 *
 * An external model arrives as opaque bytes from outside this project, so the
 * container header is the first thing standing between a host's file and the
 * ingest pipeline. Each refusal below names the exact field that disagrees --
 * the magic, the version, the declared length, the JSON chunk's alignment or
 * type, a truncated or unaligned trailing chunk, a second BIN chunk, and JSON
 * that is not decodable UTF-8 -- because an ingest failure that says only
 * "invalid model" leaves the author with a hex editor and no lead.
 *
 * Scenarios:
 *
 * 1. Header: bytes shorter than the mandatory header, a wrong magic, a version
 *    other than 2, and a declared length that disagrees with the resident
 *    bytes.
 * 2. JSON chunk: a zero length, an unaligned length, a chunk type that is not
 *    JSON, and a length reaching past the container.
 * 3. Trailing chunks: a truncated header, an unaligned length, a chunk that is not
 *    BIN, and a second BIN chunk.
 * 4. Payload and profile: JSON that is not valid UTF-8, an unsupported profile,
 *    and a path whose extension names no container at all.
 */
export const test_inspect_external_model_container = (): void => {
  const invalidUtf8 = ((): Buffer => {
    const bytes = container({});
    bytes[21] = 0xff;
    return bytes;
  })();
  TestValidator.equals(
    "an external model container is refused by the exact field that disagrees",
    namedFacts([
      [
        "shorterThanHeader",
        () =>
          throwsError(
            () => inspect(Buffer.alloc(19)),
            "shorter than its mandatory header",
          ),
      ],
      [
        "wrongMagic",
        () =>
          throwsError(
            () => inspect(container({ magic: 0x12345678 })),
            "invalid magic value",
          ),
      ],
      [
        "wrongVersion",
        () =>
          throwsError(
            () => inspect(container({ version: 1 })),
            "container version 2 is supported",
          ),
      ],
      [
        "declaredLengthDisagrees",
        () =>
          throwsError(
            () => inspect(container({ declaredLength: 999 })),
            "declared length does not match resident bytes",
          ),
      ],
      [
        "zeroJsonChunk",
        () =>
          throwsError(
            () => inspect(container({ jsonLength: 0 })),
            "not one aligned JSON chunk",
          ),
      ],
      [
        "unalignedJsonChunk",
        () =>
          throwsError(
            () => inspect(container({ jsonLength: 13 })),
            "not one aligned JSON chunk",
          ),
      ],
      [
        "jsonChunkTypeIsNotJson",
        () =>
          throwsError(
            () => inspect(container({ jsonChunkType: 0x004e4942 })),
            "not one aligned JSON chunk",
          ),
      ],
      [
        "truncatedTrailingHeader",
        () =>
          throwsError(
            () => inspect(container({ trailingBytes: 4 })),
            "truncated chunk header",
          ),
      ],
      [
        "unalignedTrailingChunk",
        () =>
          throwsError(
            () =>
              inspect(
                container({ binChunks: [{ length: 6, type: 0x004e4942 }] }),
              ),
            "unaligned or truncated chunk",
          ),
      ],
      [
        "trailingChunkIsNotBin",
        () =>
          throwsError(
            () =>
              inspect(
                container({ binChunks: [{ length: 4, type: 0x4e4f534a }] }),
              ),
            "only one optional BIN chunk",
          ),
      ],
      [
        "secondBinChunk",
        () =>
          throwsError(
            () =>
              inspect(
                container({
                  binChunks: [
                    { length: 4, type: 0x004e4942 },
                    { length: 4, type: 0x004e4942 },
                  ],
                }),
              ),
            "only one optional BIN chunk",
          ),
      ],
      [
        "jsonIsNotUtf8",
        () => throwsError(() => inspect(invalidUtf8), "JSON is invalid"),
      ],
      [
        "unsupportedProfile",
        () =>
          throwsError(
            () =>
              inspectAutoMovieExternalModelBytes({
                path: "public/models/actor.glb",
                bytes: container({}),
                profile: "sculpt-v9",
              }),
            "Unsupported external-model ingest profile",
          ),
      ],
      [
        "unknownExtension",
        () =>
          throwsError(
            () => inspect(container({}), "public/models/actor.fbx"),
            "must end in .gltf, .glb, or .vrm",
          ),
      ],
    ]),
    {
      shorterThanHeader: true,
      wrongMagic: true,
      wrongVersion: true,
      declaredLengthDisagrees: true,
      zeroJsonChunk: true,
      unalignedJsonChunk: true,
      jsonChunkTypeIsNotJson: true,
      truncatedTrailingHeader: true,
      unalignedTrailingChunk: true,
      trailingChunkIsNotBin: true,
      secondBinChunk: true,
      jsonIsNotUtf8: true,
      unsupportedProfile: true,
      unknownExtension: true,
    },
  );
};
